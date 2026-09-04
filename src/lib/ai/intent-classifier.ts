/**
 * intent-classifier.ts
 * Analyses user messages and returns a structured intent + filters
 * using Gemini's JSON mode for consistent classification.
 */

import { getClassifierModel } from './gemini';
import { parseJsonObjectResponse } from './json-response';
import { INTENT_CLASSIFIER_SYSTEM_PROMPT } from './prompts';
import { extractConstraints, intentSchema } from './recommendation-request';

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

function fastClassify(userMessage: string): ClassifiedIntent | null {
    const text = userMessage.trim().toLocaleLowerCase('he-IL');
    const filters = { ...EMPTY_FILTERS };
    if (/^(שלום|היי|הי|אהלן|בוקר טוב|ערב טוב|תודה|מה נשמע)[!. ]*$/.test(text)) {
        return { intent: 'greeting', confidence: 1, filters, search_terms: null, activity_name: null, response_hint: null };
    }
    if (text.includes('מחיר') || text.includes('כמה עולה') || text.includes('עלות')) {
        return { intent: 'price_inquiry', confidence: 0.92, filters, search_terms: [userMessage], activity_name: null, response_hint: null };
    }
    if (text.includes('מתי') || text.includes('שעות') || text.includes('לוח זמנים')) {
        return { intent: 'schedule_inquiry', confidence: 0.9, filters, search_terms: [userMessage], activity_name: null, response_hint: null };
    }
    if (text.includes('אירוע') || text.includes('אירועים')) {
        return { intent: 'search_events', confidence: 0.9, filters, search_terms: [userMessage], activity_name: null, response_hint: null };
    }
    if (text.includes('חוג') || text.includes('פעילות') || text.includes('סדנה')) {
        const constraints = extractConstraints(userMessage);
        const interests = constraints.interests ?? [];
        const hasStructuredConstraint = constraints.exactAge != null || constraints.ageMin != null || constraints.targetAgeGroup != null || constraints.days?.length || interests.length || constraints.maxPrice != null || constraints.freeOnly || constraints.locationQuery != null || constraints.startsAfter != null || constraints.endsBefore != null;
        if (!hasStructuredConstraint) return null;
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
                category_keyword: interests.length > 0 ? interests.join(' ') : null,
                max_price: constraints.maxPrice ?? null,
                target_age_group: constraints.targetAgeGroup ?? null,
                has_spots: constraints.requiresAvailability ?? null,
                free_only: constraints.freeOnly ?? null,
                branch: constraints.locationQuery ?? null,
                starts_after: constraints.startsAfter ?? null,
                starts_before: constraints.startsBefore ?? null,
                ends_before: constraints.endsBefore ?? null,
            },
            search_terms: [userMessage], activity_name: null, response_hint: interests.length > 0 ? 'recommend' : null,
        };
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
        const model = getClassifierModel();

        // Build conversation context for Gemini
        const historyContext = history.length > 0
            ? '\n\nהיסטוריית השיחה:\n' +
            history
                .slice(-6) // keep last 6 messages for context
                .map((m) => `${m.role === 'user' ? 'משתמש' : 'מתני'}: ${m.content}`)
                .join('\n')
            : '';

        const prompt = `${INTENT_CLASSIFIER_SYSTEM_PROMPT}${historyContext}\n\nשאלה חדשה מהמשתמש: "${userMessage}"\n\nהחזר JSON בלבד.`;

        // Retry logic for transient rate limits
        let text = '';
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await model.generateContent(prompt);
                text = result.response.text();
                break;
            } catch (retryErr: unknown) {
                const msg = retryErr instanceof Error ? retryErr.message : '';
                const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate');
                if (is429 && attempt < 1) {
                    const delay = 500;
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                throw retryErr;
            }
        }

        // Parse JSON — the classifier model forces JSON output
        const parsed = intentSchema.parse(parseJsonObjectResponse<unknown>(text));

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
