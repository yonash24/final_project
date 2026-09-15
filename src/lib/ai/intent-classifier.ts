/**
 * intent-classifier.ts
 * Analyses user messages and returns a structured intent + filters
 * using Gemini's JSON mode for consistent classification.
 */

import { generateStructuredOutput } from './structured-output.ts';
import { INTENT_CLASSIFIER_SYSTEM_PROMPT } from './prompts.ts';
import { extractConstraints, intentSchema } from './recommendation-request.ts';
import { matchedInterestAliases } from './activity-taxonomy.ts';

// ─── Types ──────────────────────────────────────────────

export type IntentType =
    | 'search_activities'
    | 'search_events'
    | 'activity_details'
    | 'price_inquiry'
    | 'schedule_inquiry'
    | 'age_inquiry'
    | 'availability_inquiry'
    | 'general_info'
    | 'recommendation'
    | 'greeting'
    | 'off_topic';

export interface IntentFilters {
    age: number | null;
    age_min?: number | null;
    age_max?: number | null;
    grade_min?: number | null;
    grade_max?: number | null;
    min_age_lte: number | null;
    max_age_gte: number | null;
    days: string[] | null;
    category_keyword: string | null;
    max_price: number | null;
    time_period: 'today' | 'this_week' | 'next_week' | 'this_month' | null;
    specific_date: string | null;
    target_age_group: 'kids' | 'teens' | 'adults' | 'seniors' | null;
    has_spots: boolean | null;
    free_only: boolean | null;
    branch?: string | null;
    starts_after?: string | null;
    starts_before?: string | null;
    ends_before?: string | null;
}

export interface ClassifiedIntent {
    intent: IntentType;
    confidence: number;
    filters: IntentFilters;
    search_terms: string[] | null;
    activity_name: string | null;
    response_hint: string | null;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// ─── Default (empty) filters ────────────────────────────

const EMPTY_FILTERS: IntentFilters = {
    age: null,
    age_min: null, age_max: null, grade_min: null, grade_max: null,
    min_age_lte: null,
    max_age_gte: null,
    days: null,
    category_keyword: null,
    max_price: null,
    time_period: null,
    specific_date: null,
    target_age_group: null,
    has_spots: null,
    free_only: null,
    branch: null, starts_after: null, starts_before: null, ends_before: null,
};

const LIST_ALL_PATTERNS = [
    /^(איזה|אילו|מה)\s+(ה)?חוגים\s+(יש|קיימים|מוצעים)/,
    /^(יש|תראה|הצג)\s+(לי\s+)?(את\s+)?(כל\s+)?ה?חוגים/,
];

const NO_ACTIVITY_WORD_QUESTION = /^(מה|איזה|אילו)\s+(יש|מתאים|אפשר)/;

// JS regex \b treats Hebrew letters as non-word characters, so it never
// finds a boundary between a Hebrew word and a surrounding space — use an
// explicit (start-or-space) / (space-or-end) boundary instead.
function stripStandaloneWord(text: string, pattern: string): string {
    return text.replace(new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, 'g'), ' ');
}

/**
 * Strips common Hebrew question phrasing ("כמה עולה", "מתי", "חוג", ...)
 * to recover the bare activity name a user is asking about, e.g.
 * "כמה עולה חוג קרמיקה?" -> "קרמיקה".
 */
export function extractActivityNameFromMessage(text: string): string | null {
    let result = text
        .replace(/[?!.,]/g, ' ')
        .replace(/כמה עולה/g, ' ')
        .replace(/מה (המחיר|העלות) של/g, ' ')
        .replace(/מתי (מתקיים|יש|יתקיים)?/g, ' ')
        .replace(/באיזה שעה/g, ' ')
        .replace(/לוח (ה)?זמנים( של)?/g, ' ');
    for (const word of ['מחיר', 'עלות', 'שעות', 'של', 'יש', 'את']) {
        result = stripStandaloneWord(result, word);
    }
    result = stripStandaloneWord(result, 'ה?חוג(ים|י)?');
    result = result.trim().replace(/\s+/g, ' ');
    return result.length >= 2 ? result : null;
}

export function fastClassify(userMessage: string): ClassifiedIntent | null {
    const text = userMessage.trim().toLocaleLowerCase('he-IL');
    const filters = { ...EMPTY_FILTERS };
    if (/^(שלום|היי|הי|אהלן|בוקר טוב|ערב טוב|תודה|מה נשמע)[!. ]*$/.test(text)) {
        return { intent: 'greeting', confidence: 1, filters, search_terms: null, activity_name: null, response_hint: null };
    }
    if (text.includes('מחיר') || text.includes('כמה עולה') || text.includes('עלות')) {
        const name = extractActivityNameFromMessage(userMessage);
        return { intent: 'price_inquiry', confidence: 0.92, filters, search_terms: name ? [name] : [userMessage], activity_name: name, response_hint: null };
    }
    if (text.includes('מתי') || text.includes('שעות') || text.includes('לוח זמנים')) {
        const name = extractActivityNameFromMessage(userMessage);
        return { intent: 'schedule_inquiry', confidence: 0.9, filters, search_terms: name ? [name] : [userMessage], activity_name: name, response_hint: null };
    }
    if (text.includes('אירוע') || text.includes('אירועים')) {
        return { intent: 'search_events', confidence: 0.9, filters, search_terms: [userMessage], activity_name: null, response_hint: null };
    }
    if (LIST_ALL_PATTERNS.some((pattern) => pattern.test(text))) {
        return { intent: 'search_activities', confidence: 0.95, filters, search_terms: null, activity_name: null, response_hint: null };
    }
    if (text.includes('חוג') || text.includes('פעילות') || text.includes('סדנה')) {
        const constraints = extractConstraints(userMessage);
        const interests = constraints.interests ?? [];
        const hasStructuredConstraint = constraints.exactAge != null || constraints.ageMin != null || constraints.targetAgeGroup != null || constraints.days?.length || interests.length || constraints.maxPrice != null || constraints.freeOnly || constraints.locationQuery != null || constraints.startsAfter != null || constraints.endsBefore != null;
        if (!hasStructuredConstraint) return null;
        const matchedAliases = matchedInterestAliases(userMessage);
        return {
            intent: 'search_activities', confidence: 0.94,
            filters: {
                ...filters,
                age: constraints.exactAge ?? null,
                age_min: constraints.ageMin ?? null,
                age_max: constraints.ageMax ?? null,
                grade_min: constraints.gradeMin ?? null,
                grade_max: constraints.gradeMax ?? null,
                min_age_lte: constraints.exactAge ?? null,
                max_age_gte: constraints.exactAge ?? null,
                days: constraints.days ? [...constraints.days] : null,
                category_keyword: matchedAliases.length > 0 ? matchedAliases[0] : null,
                max_price: constraints.maxPrice ?? null,
                target_age_group: constraints.targetAgeGroup ?? null,
                has_spots: constraints.requiresAvailability ?? null,
                free_only: constraints.freeOnly ?? null,
                branch: constraints.locationQuery ?? null,
                starts_after: constraints.startsAfter ?? null,
                starts_before: constraints.startsBefore ?? null,
                ends_before: constraints.endsBefore ?? null,
            },
            // A category/age/day match is a direct listing request, not a
            // request for the model to "recommend" — never hijack it into
            // the semantic-recommendation path, which demands an age.
            search_terms: [userMessage], activity_name: null, response_hint: null,
        };
    }
    if (NO_ACTIVITY_WORD_QUESTION.test(text)) {
        const constraints = extractConstraints(userMessage);
        const interests = constraints.interests ?? [];
        const hasSignal = Boolean(constraints.days?.length) || constraints.exactAge != null || constraints.targetAgeGroup != null || interests.length > 0;
        if (hasSignal) {
            const matchedAliases = matchedInterestAliases(userMessage);
            return {
                intent: 'search_activities', confidence: 0.9,
                filters: {
                    ...filters,
                    age: constraints.exactAge ?? null,
                    min_age_lte: constraints.exactAge ?? null,
                    max_age_gte: constraints.exactAge ?? null,
                    days: constraints.days?.length ? [...constraints.days] : null,
                    target_age_group: constraints.targetAgeGroup ?? null,
                    category_keyword: matchedAliases.length > 0 ? matchedAliases[0] : null,
                },
                search_terms: [userMessage], activity_name: null, response_hint: null,
            };
        }
    }
    return null;
}

// ─── Classifier ─────────────────────────────────────────

/**
 * Send the user's message (+ optional chat history) to Gemini
 * and retrieve a structured ClassifiedIntent.
 */
export async function classifyIntent(
    userMessage: string,
    history: ChatMessage[] = [],
): Promise<ClassifiedIntent> {
    const fastResult = fastClassify(userMessage);
    if (fastResult) return fastResult;

    try {
        // Build conversation context for Gemini
        const historyContext = history.length > 0
            ? '\n\nהיסטוריית השיחה:\n' +
            history
                .slice(-6) // keep last 6 messages for context
                .map((m) => `${m.role === 'user' ? 'משתמש' : 'מתני'}: ${m.content}`)
                .join('\n')
            : '';

        const prompt = `${INTENT_CLASSIFIER_SYSTEM_PROMPT}${historyContext}\n\nשאלה חדשה מהמשתמש: "${userMessage}"\n\nהחזר JSON בלבד.`;

        const parsed = await generateStructuredOutput(intentSchema, prompt, {
            temperature: 0.1,
            topP: 0.8,
        });

        // Ensure all expected fields exist with defaults
        return {
            intent: parsed.intent || 'general_info',
            confidence: parsed.confidence ?? 0.5,
            filters: { ...EMPTY_FILTERS, ...parsed.filters },
            search_terms: parsed.search_terms ?? null,
            activity_name: parsed.activity_name ?? null,
            response_hint: parsed.response_hint ?? null,
        };
    } catch (error) {
        console.error('[IntentClassifier] Failed to classify intent:', error);

        // Graceful fallback — treat as general info request
        return {
            intent: 'general_info',
            confidence: 0.0,
            filters: EMPTY_FILTERS,
            search_terms: null,
            activity_name: null,
            response_hint: 'fallback_error',
        };
    }
}
