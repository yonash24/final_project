/**
 * intent-classifier.ts
 * Analyses user messages and returns a structured intent + filters
 * using Gemini's JSON mode for consistent classification.
 */

import { getClassifierModel } from './gemini';
import { INTENT_CLASSIFIER_SYSTEM_PROMPT } from './prompts';

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
    | 'greeting'
    | 'off_topic';

export interface IntentFilters {
    age: number | null;
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
};

// ─── Classifier ─────────────────────────────────────────

/**
 * Send the user's message (+ optional chat history) to Gemini
 * and retrieve a structured ClassifiedIntent.
 */
export async function classifyIntent(
    userMessage: string,
    history: ChatMessage[] = [],
): Promise<ClassifiedIntent> {
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
        console.log(`[IntentClassifier] 📡 Prompting Gemini... (Model: ${model.model})`);

        // Retry logic for transient rate limits
        let text = '';
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) console.log(`[IntentClassifier] 🔄 Retry ${attempt}...`);
                const result = await model.generateContent(prompt);
                text = result.response.text();
                console.log('[IntentClassifier] 📬 Raw JSON response received.');
                break;
            } catch (retryErr: unknown) {
                const msg = retryErr instanceof Error ? retryErr.message : '';
                console.error(`[IntentClassifier] ⚠️ Model Error (Attempt ${attempt}):`, msg);
                const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate');
                if (is429 && attempt < 2) {
                    const delay = (attempt + 1) * 3000;
                    console.log(`[IntentClassifier] ⏳ Quota hit. Waiting ${delay}ms...`);
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                throw retryErr;
            }
        }

        // Parse JSON — the classifier model forces JSON output
        const parsed = JSON.parse(text) as ClassifiedIntent;

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
