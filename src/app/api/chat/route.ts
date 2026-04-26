/**
 * /api/chat/route.ts
 * Main chat API endpoint — production-quality RAG pipeline.
 *
 * Flow:
 *  1. Receive user message + conversation history
 *  2. Classify the intent via Gemini (JSON mode)
 *  3. Query Supabase based on the classified intent & filters
 *  4. Send DB results (or empty-state context) to Gemini for a rich Hebrew response
 *  5. Return response + raw card data for UI rendering
 */

import { NextRequest } from 'next/server';

import { classifyIntent, type ChatMessage } from '@/lib/ai/intent-classifier';
import { getChatModel } from '@/lib/ai/gemini';
import {
    CHAT_SYSTEM_PROMPT,
    formatActivitiesForContext,
    formatEventsForContext,
} from '@/lib/ai/prompts';
import { GREETING_MESSAGE } from '@/lib/ai/chat-constants';
import {
    searchActivities,
    searchEvents,
    getActivityByName,
    getUpcomingEvents,
    getCategories,
    type ActivityRow,
    type EventRow,
} from '@/lib/db/chat-queries';

// ─── Rate-limit (simple in-memory) ─────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

// ─── Helpers ────────────────────────────────────────────

/**
 * Build a rich "no results" context so the AI can still give a helpful,
 * friendly answer instead of a cold "nothing found".
 */
function buildNoResultsContext(intent: string, searchTerms?: string[] | null): string {
    const term = searchTerms?.join(', ') ?? '';
    switch (intent) {
        case 'search_activities':
        case 'age_inquiry':
        case 'schedule_inquiry':
        case 'price_inquiry':
        case 'availability_inquiry':
        case 'activity_details':
            return `לא נמצאו חוגים או פעילויות${term ? ` התואמים ל"${term}"` : ''} במאגר כרגע.\nהנח את המשתמש בנועם שכרגע אין תוצאות זמינות, הצע לו לנסות חיפוש רחב יותר, או לשאול על קטגוריה אחרת.`;
        case 'search_events':
            return `לא נמצאו אירועים${term ? ` התואמים ל"${term}"` : ''} במאגר כרגע.\nהנח את המשתמש שכרגע אין אירועים קרובים שמתאימים, והצע לו לשאול על אירועים בחודש הקרוב או חוגים קבועים.`;
        case 'general_info':
            return `המאגר ריק כרגע ולא נמצאו חוגים או אירועים.\nספר למשתמש שהמתנ"ס עובד על הוספת תוכן חדש, ושיחזור בקרוב לראות עדכונים.`;
        default:
            return 'לא נמצאו תוצאות רלוונטיות.';
    }
}

// ─── POST handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // ── Rate limiting ───────────────────────────────
        const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            'unknown';

        if (!checkRateLimit(ip)) {
            return Response.json(
                { error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' },
                { status: 429 },
            );
        }

        // ── Parse body ──────────────────────────────────
        const body = await request.json();
        const message: string | undefined = body?.message;
        const history: ChatMessage[] = body?.history ?? [];

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.error('[ChatAPI] ❌ Validation failed: Empty message');
            return Response.json(
                { error: 'נא לשלוח הודעה תקינה.' },
                { status: 400 },
            );
        }

        if (message.length > 500) {
            console.error('[ChatAPI] ❌ Validation failed: Message too long');
            return Response.json(
                { error: 'ההודעה ארוכה מדי. נסה לנסח בקצרה.' },
                { status: 400 },
            );
        }

        // ── 1. Classify intent ──────────────────────────
        const classified = await classifyIntent(message, history);

        // ── 2. Query database + collect raw data ────────
        let dbContext = '';
        let resultCount = 0;
        let activityCards: ActivityRow[] = [];
        let eventCards: EventRow[] = [];

        switch (classified.intent) {
            case 'greeting': {
                return Response.json({
                    response: GREETING_MESSAGE,
                    intent: classified.intent,
                    resultCount: 0,
                    activityCards: [],
                    eventCards: [],
                });
            }

            case 'off_topic': {
                const offTopicResponse = `אני מתמחה בכל מה שקשור למתנ"ס שלנו 😊

אני יכול לעזור לך עם:
🔍 **חיפוש חוגים ופעילויות** לכל הגילאים
📅 **אירועים קרובים** — מה קורה אצלנו
💰 **מחירים ופרטים** על כל פעילות

על מה תרצה לשמוע?`;
                return Response.json({
                    response: offTopicResponse,
                    intent: classified.intent,
                    resultCount: 0,
                    activityCards: [],
                    eventCards: [],
                });
            }

            case 'search_activities':
            case 'age_inquiry':
            case 'price_inquiry':
            case 'schedule_inquiry':
            case 'availability_inquiry': {
                activityCards = await searchActivities(classified.filters, classified.search_terms);
                resultCount = activityCards.length;
                dbContext = resultCount > 0
                    ? formatActivitiesForContext(activityCards)
                    : buildNoResultsContext(classified.intent, classified.search_terms);
                break;
            }

            case 'activity_details': {
                if (classified.activity_name) {
                    const single = await getActivityByName(classified.activity_name);
                    if (single) {
                        activityCards = [single];
                    } else {
                        // Fallback: broader search
                        activityCards = await searchActivities(
                            classified.filters,
                            classified.search_terms ?? [classified.activity_name],
                        );
                    }
                } else {
                    activityCards = await searchActivities(classified.filters, classified.search_terms);
                }
                resultCount = activityCards.length;
                dbContext = resultCount > 0
                    ? formatActivitiesForContext(activityCards)
                    : buildNoResultsContext(classified.intent, classified.search_terms ?? (classified.activity_name ? [classified.activity_name] : null));
                break;
            }

            case 'search_events': {
                eventCards = await searchEvents(classified.filters, classified.search_terms);
                resultCount = eventCards.length;
                dbContext = resultCount > 0
                    ? formatEventsForContext(eventCards)
                    : buildNoResultsContext(classified.intent, classified.search_terms);
                break;
            }

            case 'general_info': {
                const [activities, events, categories] = await Promise.all([
                    searchActivities(classified.filters, classified.search_terms),
                    getUpcomingEvents(30),
                    getCategories(),
                ]);

                activityCards = activities;
                eventCards = events;
                resultCount = activities.length + events.length;

                if (resultCount > 0) {
                    const parts: string[] = [];
                    if (activities.length > 0) parts.push('=== חוגים ===\n' + formatActivitiesForContext(activities));
                    if (events.length > 0) parts.push('=== אירועים קרובים ===\n' + formatEventsForContext(events));
                    if (categories.length > 0) {
                        parts.push(
                            '=== קטגוריות זמינות ===\n' +
                            categories.map((c) => `${c.icon || '📁'} ${c.name_he}`).join('\n'),
                        );
                    }
                    dbContext = parts.join('\n\n');
                } else {
                    dbContext = buildNoResultsContext('general_info');
                }
                break;
            }
        }

        // ── 3. Generate natural language response ───────
        const chatModel = getChatModel();

        const hasResults = resultCount > 0;

        const contextPrompt = `${CHAT_SYSTEM_PROMPT}

## מצב הנתונים:
${hasResults
                ? `נמצאו ${resultCount} תוצאות רלוונטיות. הנה הנתונים:`
                : `לא נמצאו תוצאות. הסבר בנועם שכרגע אין משהו זמין שעונה על הבקשה, והצע חלופות.`}

## נתונים שנשלפו מהדאטהבייס:

${dbContext}

## היסטוריית השיחה:
${history
                .slice(-8)
                .map((m) => `${m.role === 'user' ? 'משתמש' : 'מתני'}: ${m.content}`)
                .join('\n')}

## ההודעה הנוכחית מהמשתמש:
"${message}"

## הוראות חשובות:
${hasResults
                ? `- כתוב תשובה ידידותית ומעוצבת בעברית.
- ציין שנמצאו תוצאות וסכם אותן בנעימות.
- אם יש כרטיסים שיוצגו ב-UI, הזכר שהם מוצגים מטה (למשל: "הנה מה שמצאתי:" או "מצאתי עבורך:").
- בסוף, הצע שאלת המשך קצרה.`
                : `- הסבר בחום ובנועם שכרגע לא נמצא מה שהמשתמש חיפש.
- אל תאמר ש"המאגר ריק" או תזכיר מונחים טכניים.
- הצע לנסות חיפוש רחב יותר, קטגוריה אחרת, או לשאול שאלה אחרת.
- שמור על אופטימיות — למשל: "אולי נמצא משהו אחר שיתאים לך?"
- בסוף, הצע שאלת המשך קצרה.`}`;

        // Retry logic for Gemini (handles transient rate limits)
        let response = '';
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await chatModel.generateContent(contextPrompt);
                response = result.response.text();
                lastError = null;
                break;
            } catch (geminiErr: unknown) {
                lastError = geminiErr;
                const msg = geminiErr instanceof Error ? geminiErr.message : '';
                console.error(`[ChatAPI] ⚠️ Gemini Error (Attempt ${attempt}):`, msg);
                const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate');
                if (is429 && attempt < 2) {
                    const delay = (attempt + 1) * 3000;
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                break;
            }
        }

        if (lastError) {
            console.error('[ChatAPI] 🛑 Max retries reached for Gemini response generation.');
            throw lastError;
        }

        // Limit card count to avoid huge payloads
        return Response.json({
            response,
            intent: classified.intent,
            resultCount,
            activityCards: activityCards.slice(0, 8),
            eventCards: eventCards.slice(0, 8),
        });
    } catch (error) {
        console.error('[ChatAPI] Unexpected error:', error);

        // Return a friendly error message in Hebrew
        const errorMessage = error instanceof Error ? error.message : String(error);
        const status = (error as any)?.status;

        // Accurate detection: if Gemini explicitly returned 429, or message contains quota words
        const isQuotaExceeded = status === 429 ||
            errorMessage.includes('429') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('rate');

        console.error(`[ChatAPI] 🛑 API Final Error:`, { status, message: errorMessage });

        return Response.json(
            {
                response: isQuotaExceeded
                    ? 'הגענו למכסת ההודעות החינמית של גוגל. אנא נסה שוב בעוד דקה.'
                    : 'אירעה שגיאה בחיבור לשרתי ה-AI. אנא נסו שוב בקרוב.',
                error: errorMessage,
                resultCount: 0,
                activityCards: [],
                eventCards: [],
                intent: 'general_info'
            },
            { status: isQuotaExceeded ? 429 : (status || 500) },
        );
    }
}
