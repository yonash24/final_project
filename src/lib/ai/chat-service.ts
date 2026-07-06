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

const CLARIFICATION_THRESHOLD = 0.58;

function createResponse(
    responseType: ChatApiResponse['responseType'],
    response: string,
    intent: string,
    activityCards: ActivityRow[] = [],
    eventCards: EventRow[] = [],
    clarificationOptions?: ClarificationOption[],
): ChatApiResponse {
    return {
        responseType,
        response,
        intent,
        resultCount: activityCards.length + eventCards.length,
        activityCards,
        eventCards,
        clarificationOptions,
    };
}

function buildClarification(intent: string, response: string, options?: ClarificationOption[]) {
    return createResponse('clarification', response, intent, [], [], options);
}

function formatActivityLine(activity: ActivityRow) {
    const parts = [activity.title_he];
    if (activity.days_of_week) parts.push(activity.days_of_week);
    if (activity.start_time) parts.push(activity.start_time.slice(0, 5));
    return parts.join(' | ');
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
        return `מצאתי חוג אחד שמתאים בדיוק למה שביקשת:\n**${formatActivityLine(activities[0])}**`;
    }

    return `מצאתי ${activities.length} חוגים תואמים. ריכזתי אותם בכרטיסים כאן למטה כדי שתוכל לבחור בקלות.`;
}

function buildEventsResultsResponse(events: EventRow[]) {
    if (events.length === 1) {
        return `מצאתי אירוע אחד רלוונטי: **${events[0].title}**. כל הפרטים מופיעים בכרטיס שמתחת.`;
    }

    return `מצאתי ${events.length} אירועים רלוונטיים. ריכזתי אותם בכרטיסים כאן למטה.`;
}

function buildNoResultsResponse(intent: string) {
    switch (intent) {
        case 'search_events':
            return createResponse('answer', 'לא מצאתי כרגע אירועים שמתאימים בדיוק לבקשה. אפשר לנסות תאריך אחר או קטגוריה אחרת.', intent);
        case 'price_inquiry':
        case 'schedule_inquiry':
        case 'activity_details':
        case 'search_activities':
        case 'age_inquiry':
        case 'availability_inquiry':
            return createResponse('answer', 'לא מצאתי כרגע חוג שמתאים בדיוק לבקשה. אפשר לכתוב את שם החוג, גיל, יום או תחום כדי שאדייק.', intent);
        default:
            return createResponse('answer', 'לא מצאתי כרגע מידע מדויק על מה שביקשת. אם תכתוב בצורה קצת יותר ממוקדת, אדייק מיד.', intent);
    }
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

export async function getChatResponse(
    message: string,
    history: ChatMessage[] = [],
): Promise<ChatApiResponse> {
    const classified = await classifyIntent(message, history);

    if (classified.intent === 'greeting') {
        return createResponse('answer', GREETING_MESSAGE, classified.intent);
    }

    if (classified.intent === 'off_topic') {
        return createResponse(
            'answer',
            'אני מתמחה בחוגים, אירועים ופעילויות של המתנ״ס. אם תכתוב מה אתה מחפש, אני אתמקד רק בזה.',
            classified.intent,
        );
    }

    if (classified.confidence < CLARIFICATION_THRESHOLD) {
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
            if (activityCards.length === 0) return buildNoResultsResponse(classified.intent);
            return createResponse('results', buildActivitiesResultsResponse(activityCards), classified.intent, activityCards.slice(0, 8));
        }

        case 'price_inquiry':
        case 'schedule_inquiry':
        case 'activity_details': {
            if (classified.activity_name) {
                const exact = await getActivityByName(classified.activity_name);
                if (exact) {
                    activityCards = [exact];
                }
            }

            if (activityCards.length === 0) {
                activityCards = await searchActivities(classified.filters, classified.search_terms);
            }

            if (activityCards.length === 0) return buildNoResultsResponse(classified.intent);
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
            if (eventCards.length === 0) return buildNoResultsResponse(classified.intent);
            return createResponse('results', buildEventsResultsResponse(eventCards), classified.intent, [], eventCards.slice(0, 8));
        }

        case 'general_info': {
            if (classified.confidence < 0.72) {
                return buildClarification(
                    classified.intent,
                    'אשמח לדייק. אתה מחפש חוגים, אירועים, מחירים או פרטים על פעילות מסוימת?',
                    [
                        { label: 'חוגים לילדים', value: 'יש חוגים לילדים?' },
                        { label: 'אירועים קרובים', value: 'אילו אירועים קרובים יש?' },
                        { label: 'מחירי חוגים', value: 'מה המחירים של החוגים?' },
                    ],
                );
            }

            const [activities, events, categories] = await Promise.all([
                searchActivities(classified.filters, classified.search_terms),
                getUpcomingEvents(14),
                getCategories(),
            ]);

            const summaryParts = [
                activities.length > 0 ? `יש כרגע ${activities.length} חוגים שעשויים להתאים למה שחיפשת.` : 'לא מצאתי חוגים מדויקים לפי הניסוח הזה.',
                events.length > 0 ? `בנוסף יש ${events.length} אירועים קרובים.` : 'אין כרגע אירועים קרובים שתואמים במיוחד לבקשה.',
                categories.length > 0 ? `אפשר גם לחפש לפי תחום כמו ${categories.slice(0, 4).map((item) => item.name_he).join(', ')}.` : null,
            ].filter(Boolean);

            return createResponse('answer', summaryParts.join(' '), classified.intent, activities.slice(0, 6), events.slice(0, 4));
        }

        default:
            return createResponse('answer', 'אני כאן כדי לעזור עם חוגים, אירועים ופעילויות של המתנ״ס. אפשר לשאול אותי בצורה ממוקדת יותר.', classified.intent);
    }
}
