import { GREETING_MESSAGE } from '@/lib/ai/chat-constants';
import { type ChatApiResponse, type ClarificationOption } from '@/lib/ai/chat-types';
import { classifyIntent, type ChatMessage } from '@/lib/ai/intent-classifier';
import {
    getActivityByName,
    getCategories,
    getUpcomingEvents,
    searchActivities,
    searchEvents,
    type ActivityRow,
    type EventRow,
} from '@/lib/db/chat-queries';
import {
    semanticSearchActivities,
    semanticSearchEvents,
    semanticSearchKnowledge,
    type KnowledgeResult,
} from '@/lib/ai/semantic-search';
import { getChatModel } from '@/lib/ai/gemini';
import {
    CHAT_SYSTEM_PROMPT,
    formatActivitiesForContext,
    formatEventsForContext,
} from '@/lib/ai/prompts';

const CLARIFICATION_THRESHOLD = 0.58;

// ─── Session Preferences (extracted from conversation) ──

interface SessionPreferences {
    mentionedAges: number[];
    preferredDays: string[];
    preferredCategories: string[];
    budgetMax: number | null;
    ageGroup: string | null;
}

function extractSessionPreferences(history: ChatMessage[]): SessionPreferences {
    const prefs: SessionPreferences = {
        mentionedAges: [],
        preferredDays: [],
        preferredCategories: [],
        budgetMax: null,
        ageGroup: null,
    };

    for (const msg of history) {
        if (msg.role !== 'user') continue;
        const text = msg.content;

        // Extract ages
        const ageMatches = text.match(/\b(בן|בת|גיל)\s*(\d{1,2})\b/g);
        if (ageMatches) {
            for (const m of ageMatches) {
                const num = m.match(/\d+/);
                if (num) prefs.mentionedAges.push(parseInt(num[0]));
            }
        }

        // Extract days
        const dayMap: Record<string, string> = {
            'ראשון': 'ראשון', 'שני': 'שני', 'שלישי': 'שלישי',
            'רביעי': 'רביעי', 'חמישי': 'חמישי', 'שישי': 'שישי',
        };
        for (const [key, val] of Object.entries(dayMap)) {
            if (text.includes(key)) prefs.preferredDays.push(val);
        }

        // Extract budget
        const budgetMatch = text.match(/עד\s*(\d+)\s*₪|תקציב\s*(\d+)|מקסימום\s*(\d+)/);
        if (budgetMatch) {
            const val = budgetMatch[1] || budgetMatch[2] || budgetMatch[3];
            prefs.budgetMax = parseInt(val);
        }

        // Age group detection
        if (text.includes('ילדים') || text.includes('ילד')) prefs.ageGroup = 'kids';
        if (text.includes('נוער') || text.includes('מתבגר')) prefs.ageGroup = 'teens';
        if (text.includes('מבוגרים') || text.includes('למבוגרים')) prefs.ageGroup = 'adults';
        if (text.includes('קשישים') || text.includes('גיל שלישי')) prefs.ageGroup = 'seniors';
    }

    return prefs;
}

// ─── Response Builders ──────────────────────────────────

function createResponse(
    responseType: ChatApiResponse['responseType'],
    response: string,
    intent: string,
    activityCards: ActivityRow[] = [],
    eventCards: EventRow[] = [],
    clarificationOptions?: ClarificationOption[],
    knowledgeContext?: string,
): ChatApiResponse {
    return {
        responseType,
        response,
        intent,
        resultCount: activityCards.length + eventCards.length,
        activityCards,
        eventCards,
        clarificationOptions,
        knowledgeContext,
    };
}

function buildClarification(intent: string, response: string, options?: ClarificationOption[]) {
    return createResponse('clarification', response, intent, [], [], options);
}

function buildPriceResponse(activity: ActivityRow) {
    const price = activity.price === 0 || activity.price == null ? 'חינם' : `${activity.price}₪ לחודש`;
    const schedule = activity.days_of_week
        ? `החוג מתקיים ב${activity.days_of_week}${activity.start_time ? ` בשעה ${activity.start_time.slice(0, 5)}` : ''}.`
        : '';
    return `המחיר של **${activity.title_he}** הוא ${price}. ${schedule}`.trim();
}

function buildScheduleResponse(activity: ActivityRow) {
    const schedule = activity.days_of_week
        ? `${activity.days_of_week}${activity.start_time ? ` בשעה ${activity.start_time.slice(0, 5)}` : ''}${activity.end_time ? ` עד ${activity.end_time.slice(0, 5)}` : ''}`
        : 'לא צוין עדיין';
    return `לוח הזמנים של **${activity.title_he}** הוא: ${schedule}.`;
}

function buildDetailsResponse(activity: ActivityRow) {
    const detailParts = [
        `**${activity.title_he}**`,
        activity.description_he || 'אין כרגע תיאור מפורט.',
        activity.instructor_name ? `מדריך/ה: ${activity.instructor_name}.` : null,
        activity.location ? `מיקום: ${activity.location}.` : null,
        activity.min_age != null || activity.max_age != null ? `גילים: ${activity.min_age ?? 0}-${activity.max_age ?? '+'}.` : null,
    ].filter(Boolean);
    return detailParts.join('\n');
}

function buildActivitiesResultsResponse(activities: ActivityRow[]) {
    if (activities.length === 1) {
        return `מצאתי חוג אחד שמתאים בדיוק למה שביקשת:\n**${activities[0].title_he}**`;
    }
    return `מצאתי ${activities.length} חוגים תואמים. ריכזתי אותם בכרטיסים כאן למטה כדי שתוכל לבחור בקלות.`;
}

function buildEventsResultsResponse(events: EventRow[]) {
    if (events.length === 1) {
        return `מצאתי אירוע אחד רלוונטי: **${events[0].title}**. כל הפרטים מופיעים בכרטיס שמתחת.`;
    }
    return `מצאתי ${events.length} אירועים רלוונטיים. ריכזתי אותם בכרטיסים כאן למטה.`;
}

function buildMultiMatchClarification(intent: string, activities: ActivityRow[]) {
    const options = activities.slice(0, 4).map((activity) => ({
        label: activity.title_he,
        value: `ספר לי על ${activity.title_he}`,
    }));
    return buildClarification(
        intent,
        'מצאתי כמה חוגים דומים, וכדי לא לתת פרטים לא נכונים אני צריך שתבחר את החוג המדויק:',
        options,
    );
}

function formatKnowledgeForContext(knowledge: KnowledgeResult[]): string {
    if (!knowledge || knowledge.length === 0) return '';
    return knowledge
        .map((k) => `[מידע: ${k.title_he}]\n${k.content_he}`)
        .join('\n\n');
}

// ─── RAG-Enhanced Fallback ──────────────────────────────

async function generateRAGResponse(
    message: string,
    knowledge: KnowledgeResult[],
    activities: ActivityRow[],
    events: EventRow[],
    sessionPrefs: SessionPreferences,
): Promise<string> {
    const chatModel = getChatModel();

    let context = '';
    if (knowledge.length > 0) {
        context += '## מידע רלוונטי מבסיס הידע:\n' + formatKnowledgeForContext(knowledge) + '\n\n';
    }
    if (activities.length > 0) {
        context += '## חוגים רלוונטיים:\n' + formatActivitiesForContext(activities) + '\n\n';
    }
    if (events.length > 0) {
        context += '## אירועים רלוונטיים:\n' + formatEventsForContext(events) + '\n\n';
    }

    // Add session preferences context
    let prefsContext = '';
    if (sessionPrefs.mentionedAges.length > 0) {
        prefsContext += `המשתמש הזכיר גילאים: ${sessionPrefs.mentionedAges.join(', ')}. `;
    }
    if (sessionPrefs.preferredDays.length > 0) {
        prefsContext += `ימים מועדפים: ${sessionPrefs.preferredDays.join(', ')}. `;
    }
    if (sessionPrefs.budgetMax) {
        prefsContext += `תקציב מקסימלי: ${sessionPrefs.budgetMax}₪. `;
    }
    if (sessionPrefs.ageGroup) {
        prefsContext += `קבוצת גיל: ${sessionPrefs.ageGroup}. `;
    }

    const prompt = `${CHAT_SYSTEM_PROMPT}

${context}
${prefsContext ? `## העדפות שהמשתמש ציין בשיחה:\n${prefsContext}\n\n` : ''}
## הודעה מהמשתמש:
"${message}"

ענה בעברית. אם יש מידע רלוונטי מבסיס הידע — השתמש בו. אם אין — תן תשובה כללית מועילה.`;

    try {
        const result = await chatModel.generateContent(prompt);
        return result.response.text();
    } catch {
        return 'מצטער, נתקלתי בבעיה טכנית. אפשר לנסות שוב בעוד רגע.';
    }
}

// ─── No Results with RAG Fallback ───────────────────────

async function buildNoResultsWithRAG(
    intent: string,
    message: string,
    sessionPrefs: SessionPreferences,
): Promise<ChatApiResponse> {
    // Try semantic search as fallback
    const [semanticActivities, semanticEvents, knowledge] = await Promise.all([
        semanticSearchActivities(message, 0.35, 4),
        semanticSearchEvents(message, 0.35, 3),
        semanticSearchKnowledge(message, 0.3, 3),
    ]);

    const hasSemanticResults = semanticActivities.length > 0 || semanticEvents.length > 0;
    const hasKnowledge = knowledge.length > 0;

    if (hasSemanticResults) {
        // Found results via semantic search that keyword search missed
        const response = semanticActivities.length > 0
            ? buildActivitiesResultsResponse(semanticActivities)
            : buildEventsResultsResponse(semanticEvents);

        return createResponse(
            'results',
            `לא מצאתי התאמה מדויקת, אבל הנה כמה אפשרויות שעשויות לעניין אותך:\n${response}`,
            intent,
            semanticActivities.slice(0, 6),
            semanticEvents.slice(0, 4),
        );
    }

    if (hasKnowledge) {
        // Found relevant knowledge base info
        const ragResponse = await generateRAGResponse(message, knowledge, [], [], sessionPrefs);
        return createResponse('answer', ragResponse, intent, [], [], undefined, formatKnowledgeForContext(knowledge));
    }

    // True no-results — give helpful fallback
    const fallbackMessages: Record<string, string> = {
        search_events: 'לא מצאתי כרגע אירועים שמתאימים. אפשר לנסות תאריך אחר, קטגוריה אחרת, או לשאול אותי שאלה כללית.',
        search_activities: 'לא מצאתי חוג שמתאים בדיוק. אפשר לנסות לחפש לפי גיל, יום, תחום, או פשוט לכתוב מה מעניין אתכם ואני אחפש מחדש.',
        price_inquiry: 'לא מצאתי את החוג הספציפי. אפשר לכתוב את שם החוג מדויק יותר?',
        schedule_inquiry: 'לא מצאתי חוג בשם הזה. אפשר לנסות שם אחר?',
        activity_details: 'לא מצאתי חוג בשם הזה. אפשר לנסות שם אחר?',
    };

    const fallback = fallbackMessages[intent]
        || 'לא מצאתי מידע מדויק. אם תכתבו בצורה יותר ממוקדת — שם חוג, גיל, יום, או תחום — אדייק מיד.';

    return createResponse('answer', fallback, intent, [], [], [
        { label: '🎯 חוגים לילדים', value: 'יש חוגים לילדים?' },
        { label: '📅 אירועים קרובים', value: 'אילו אירועים יש?' },
        { label: '💰 חוגים בחינם', value: 'יש חוגים בחינם?' },
    ]);
}

// ─── Recommendation Handler ────────────────────────────

async function handleRecommendation(
    message: string,
    sessionPrefs: SessionPreferences,
): Promise<ChatApiResponse> {
    // Use semantic search to find relevant activities
    const activities = await semanticSearchActivities(message, 0.35, 8);

    // Filter based on session preferences if available
    let filtered = activities;
    if (sessionPrefs.budgetMax) {
        filtered = filtered.filter((a) => a.price == null || a.price <= sessionPrefs.budgetMax!);
    }
    if (sessionPrefs.ageGroup) {
        filtered = filtered.filter((a) => !a.target_age_group || a.target_age_group === sessionPrefs.ageGroup);
    }

    if (filtered.length === 0 && activities.length > 0) {
        filtered = activities; // Fall back to unfiltered
    }

    if (filtered.length > 0) {
        return createResponse(
            'results',
            `על סמך מה שסיפרת לי, הנה כמה המלצות שלי 🎯`,
            'recommendation',
            filtered.slice(0, 6),
        );
    }

    return createResponse(
        'answer',
        'אני צריך קצת יותר מידע כדי להמליץ. ספרו לי: מה הגיל? באיזה ימים נוח? איזה סוג פעילות מעניין?',
        'recommendation',
        [],
        [],
        [
            { label: '🎨 אומנות ויצירה', value: 'אני מחפש חוגי אומנות' },
            { label: '⚽ ספורט', value: 'יש חוגי ספורט?' },
            { label: '🎵 מוזיקה', value: 'מעניין אותי חוגי מוזיקה' },
        ],
    );
}

// ─── General Info with RAG ──────────────────────────────

async function handleGeneralInfoWithRAG(
    message: string,
    classified: { filters: Parameters<typeof searchActivities>[0]; search_terms: string[] | null; confidence: number },
    sessionPrefs: SessionPreferences,
): Promise<ChatApiResponse> {
    if (classified.confidence < 0.72) {
        // Try knowledge base first for low-confidence general queries
        const knowledge = await semanticSearchKnowledge(message, 0.4, 3);
        if (knowledge.length > 0) {
            const ragResponse = await generateRAGResponse(message, knowledge, [], [], sessionPrefs);
            return createResponse('answer', ragResponse, 'general_info');
        }

        return buildClarification(
            'general_info',
            'אשמח לדייק. אתה מחפש חוגים, אירועים, מחירים, או מידע כללי על המתנ"ס?',
            [
                { label: 'חוגים לילדים', value: 'יש חוגים לילדים?' },
                { label: 'אירועים קרובים', value: 'אילו אירועים קרובים יש?' },
                { label: 'מחירי חוגים', value: 'מה המחירים של החוגים?' },
                { label: 'שעות פתיחה', value: 'מה שעות הפתיחה של המתנ"ס?' },
            ],
        );
    }

    // Fetch from all sources in parallel
    const [activities, events, categories, knowledge] = await Promise.all([
        searchActivities(classified.filters, classified.search_terms),
        getUpcomingEvents(14),
        getCategories(),
        semanticSearchKnowledge(message, 0.4, 2),
    ]);

    // If knowledge is highly relevant, generate RAG response
    if (knowledge.length > 0 && activities.length === 0 && events.length === 0) {
        const ragResponse = await generateRAGResponse(message, knowledge, [], [], sessionPrefs);
        return createResponse('answer', ragResponse, 'general_info');
    }

    const summaryParts = [
        activities.length > 0
            ? `יש כרגע ${activities.length} חוגים שעשויים להתאים.`
            : 'לא מצאתי חוגים מדויקים לפי הניסוח הזה.',
        events.length > 0
            ? `בנוסף יש ${events.length} אירועים קרובים.`
            : '',
        categories.length > 0
            ? `אפשר לחפש לפי תחום: ${categories.slice(0, 4).map((c) => c.name_he).join(', ')}.`
            : null,
    ].filter(Boolean);

    return createResponse(
        'answer',
        summaryParts.join(' '),
        'general_info',
        activities.slice(0, 6),
        events.slice(0, 4),
    );
}

// ─── Main Entry Point ───────────────────────────────────

export async function getChatResponse(
    message: string,
    history: ChatMessage[] = [],
): Promise<ChatApiResponse> {
    const classified = await classifyIntent(message, history);
    const sessionPrefs = extractSessionPreferences(history);

    // Greeting
    if (classified.intent === 'greeting') {
        return createResponse('answer', GREETING_MESSAGE, classified.intent);
    }

    // Off-topic
    if (classified.intent === 'off_topic') {
        // Check knowledge base — might be a valid question about the center
        const knowledge = await semanticSearchKnowledge(message, 0.5, 2);
        if (knowledge.length > 0) {
            const ragResponse = await generateRAGResponse(message, knowledge, [], [], sessionPrefs);
            return createResponse('answer', ragResponse, 'general_info');
        }
        return createResponse(
            'answer',
            'אני מתמחה בחוגים, אירועים ופעילויות של המתנ״ס. אם תכתוב מה אתה מחפש, אני אתמקד רק בזה.',
            classified.intent,
        );
    }

    // Recommendation intent (new)
    if (classified.intent === 'recommendation' || classified.response_hint === 'recommend') {
        return handleRecommendation(message, sessionPrefs);
    }

    // Low confidence — ask for clarification
    if (classified.confidence < CLARIFICATION_THRESHOLD) {
        // Try RAG before giving up
        const knowledge = await semanticSearchKnowledge(message, 0.4, 2);
        if (knowledge.length > 0) {
            const ragResponse = await generateRAGResponse(message, knowledge, [], [], sessionPrefs);
            return createResponse('answer', ragResponse, classified.intent);
        }

        return buildClarification(
            classified.intent,
            'כדי לדייק ולא לשלוח פרטים לא רלוונטיים, אשמח אם תחדד למה התכוונת: שם חוג, גיל, יום או אירוע מסוים.',
        );
    }

    let activityCards: ActivityRow[] = [];
    let eventCards: EventRow[] = [];

    switch (classified.intent) {
        case 'search_activities':
        case 'age_inquiry':
        case 'availability_inquiry': {
            activityCards = await searchActivities(classified.filters, classified.search_terms);

            // If keyword search finds nothing, try semantic search
            if (activityCards.length === 0) {
                return buildNoResultsWithRAG(classified.intent, message, sessionPrefs);
            }
            return createResponse('results', buildActivitiesResultsResponse(activityCards), classified.intent, activityCards.slice(0, 8));
        }

        case 'price_inquiry':
        case 'schedule_inquiry':
        case 'activity_details': {
            if (classified.activity_name) {
                const exact = await getActivityByName(classified.activity_name);
                if (exact) activityCards = [exact];
            }

            if (activityCards.length === 0) {
                activityCards = await searchActivities(classified.filters, classified.search_terms);
            }

            // Semantic fallback
            if (activityCards.length === 0) {
                return buildNoResultsWithRAG(classified.intent, message, sessionPrefs);
            }
            if (activityCards.length > 1) return buildMultiMatchClarification(classified.intent, activityCards);

            const activity = activityCards[0];
            const response =
                classified.intent === 'price_inquiry'
                    ? buildPriceResponse(activity)
                    : classified.intent === 'schedule_inquiry'
                        ? buildScheduleResponse(activity)
                        : buildDetailsResponse(activity);

            return createResponse(
                classified.intent === 'activity_details' ? 'results' : 'answer',
                response,
                classified.intent,
                classified.intent === 'activity_details' ? [activity] : [],
            );
        }

        case 'search_events': {
            eventCards = await searchEvents(classified.filters, classified.search_terms);
            if (eventCards.length === 0) {
                return buildNoResultsWithRAG(classified.intent, message, sessionPrefs);
            }
            return createResponse('results', buildEventsResultsResponse(eventCards), classified.intent, [], eventCards.slice(0, 8));
        }

        case 'general_info': {
            return handleGeneralInfoWithRAG(message, classified, sessionPrefs);
        }

        default:
            return createResponse('answer', 'אני כאן כדי לעזור עם חוגים, אירועים ופעילויות של המתנ״ס. אפשר לשאול אותי בצורה ממוקדת יותר.', classified.intent);
    }
}
