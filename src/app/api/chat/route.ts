/**
 * /api/chat/route.ts
 * Main chat API endpoint.
 *
 * Flow:
 *  1. Receive user message + conversation history
 *  2. Classify the intent via Gemini (JSON mode)
 *  3. Query Supabase based on the classified intent
 *  4. Send DB results + message to Gemini for a friendly Hebrew response
 *  5. Return the response
 */

import { NextRequest } from 'next/server';

import { classifyIntent, type ChatMessage } from '@/lib/ai/intent-classifier';
import { getChatModel } from '@/lib/ai/gemini';
import {
    CHAT_SYSTEM_PROMPT,
    GREETING_MESSAGE,
    formatActivitiesForContext,
    formatEventsForContext,
} from '@/lib/ai/prompts';
import {
    searchActivities,
    searchEvents,
    getActivityByName,
    getUpcomingEvents,
    getCategories,
} from '@/lib/db/chat-queries';

// ─── Rate-limit (simple in-memory) ─────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
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
            return Response.json(
                { error: 'נא לשלוח הודעה תקינה.' },
                { status: 400 },
            );
        }

        // Limit message length
        if (message.length > 500) {
            return Response.json(
                { error: 'ההודעה ארוכה מדי. נסה לנסח בקצרה.' },
                { status: 400 },
            );
        }

        // ── 1. Classify intent ──────────────────────────
        const classified = await classifyIntent(message, history);
        console.log('[ChatAPI] Classified intent:', JSON.stringify(classified, null, 2));

        // ── 2. Query database based on intent ───────────
        let dbContext = '';
        let resultCount = 0;

        switch (classified.intent) {
            case 'greeting': {
                // No DB query needed — return predefined greeting
                return Response.json({
                    response: GREETING_MESSAGE,
                    intent: classified.intent,
                    resultCount: 0,
                });
            }

            case 'off_topic': {
                const offTopicResponse = `אני מתמחה בכל מה שקשור למתנ"ס שלנו 😊

אני יכול לעזור לך עם:
🔍 חיפוש חוגים ופעילויות
📅 אירועים קרובים
💰 מחירים ופרטים

על מה תרצה לשמוע?`;
                return Response.json({
                    response: offTopicResponse,
                    intent: classified.intent,
                    resultCount: 0,
                });
            }

            case 'search_activities':
            case 'age_inquiry':
            case 'price_inquiry':
            case 'schedule_inquiry':
            case 'availability_inquiry': {
                const activities = await searchActivities(
                    classified.filters,
                    classified.search_terms,
                );
                resultCount = activities.length;
                dbContext = formatActivitiesForContext(activities);
                break;
            }

            case 'activity_details': {
                if (classified.activity_name) {
                    const activity = await getActivityByName(classified.activity_name);
                    if (activity) {
                        resultCount = 1;
                        dbContext = formatActivitiesForContext([activity]);
                    } else {
                        // Fall back to search
                        const activities = await searchActivities(
                            classified.filters,
                            classified.search_terms ?? [classified.activity_name],
                        );
                        resultCount = activities.length;
                        dbContext = formatActivitiesForContext(activities);
                    }
                } else {
                    const activities = await searchActivities(
                        classified.filters,
                        classified.search_terms,
                    );
                    resultCount = activities.length;
                    dbContext = formatActivitiesForContext(activities);
                }
                break;
            }

            case 'search_events': {
                const events = await searchEvents(
                    classified.filters,
                    classified.search_terms,
                );
                resultCount = events.length;
                dbContext = formatEventsForContext(events);
                break;
            }

            case 'general_info': {
                // Provide both activities and upcoming events as context
                const [activities, events, categories] = await Promise.all([
                    searchActivities(classified.filters, classified.search_terms),
                    getUpcomingEvents(14),
                    getCategories(),
                ]);

                const parts: string[] = [];

                if (activities.length > 0) {
                    parts.push('=== חוגים ===\n' + formatActivitiesForContext(activities));
                    resultCount += activities.length;
                }
                if (events.length > 0) {
                    parts.push('=== אירועים קרובים ===\n' + formatEventsForContext(events));
                    resultCount += events.length;
                }
                if (categories.length > 0) {
                    parts.push(
                        '=== קטגוריות זמינות ===\n' +
                        categories.map((c) => `${c.icon || '📁'} ${c.name_he}`).join('\n'),
                    );
                }

                dbContext = parts.join('\n\n') || 'לא נמצאו תוצאות רלוונטיות בדאטהבייס.';
                break;
            }
        }

        // ── 3. Generate natural response via Gemini ─────
        const chatModel = getChatModel();

        const contextPrompt = `${CHAT_SYSTEM_PROMPT}

## נתונים שנשלפו מהדאטהבייס (${resultCount} תוצאות):

${dbContext}

## היסטוריית השיחה:
${history
                .slice(-8)
                .map((m) => `${m.role === 'user' ? 'משתמש' : 'מתני'}: ${m.content}`)
                .join('\n')}

## ההודעה הנוכחית מהמשתמש:
"${message}"

כתוב תשובה ידידותית ומעוצבת בעברית על בסיס הנתונים שקיבלת.`;

        const result = await chatModel.generateContent(contextPrompt);
        const response = result.response.text();

        return Response.json({
            response,
            intent: classified.intent,
            resultCount,
        });
    } catch (error) {
        console.error('[ChatAPI] Unexpected error:', error);
        return Response.json(
            {
                error: 'אירעה שגיאה בלתי צפויה. נא לנסות שוב.',
                response: 'מצטער, משהו השתבש 😕 נסה שוב בבקשה.',
            },
            { status: 500 },
        );
    }
}
