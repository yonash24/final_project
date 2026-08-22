import { z } from 'zod';
import { interestsFromText, type ActivityInterest } from './activity-taxonomy';
import type { ClassifiedIntent, ChatMessage, IntentFilters } from './intent-classifier';

export type AgeGroup = 'kids' | 'teens' | 'adults' | 'seniors';

export interface RecommendationRequest {
    exactAge: number | null;
    targetAgeGroup: AgeGroup | null;
    interests: readonly ActivityInterest[];
    hardInterests: readonly ActivityInterest[];
    days: readonly string[];
    maxPrice: number | null;
    freeOnly: boolean;
    requiresAvailability: boolean;
    locationQuery: string | null;
    accessibilityNeeds: readonly string[];
    explicitConstraints: readonly string[];
}

const AGE_GROUPS = ['kids', 'teens', 'adults', 'seniors'] as const;
export const intentFiltersSchema = z.object({
    age: z.number().int().min(0).max(120).nullable().catch(null),
    min_age_lte: z.number().int().min(0).max(120).nullable().catch(null),
    max_age_gte: z.number().int().min(0).max(120).nullable().catch(null),
    days: z.array(z.string()).nullable().catch(null),
    category_keyword: z.string().max(80).nullable().catch(null),
    max_price: z.number().min(0).max(1_000_000).nullable().catch(null),
    time_period: z.enum(['today', 'this_week', 'next_week', 'this_month']).nullable().catch(null),
    specific_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
    target_age_group: z.enum(AGE_GROUPS).nullable().catch(null),
    has_spots: z.boolean().nullable().catch(null),
    free_only: z.boolean().nullable().catch(null),
});
export const intentSchema = z.object({
    intent: z.enum(['search_activities', 'search_events', 'activity_details', 'price_inquiry', 'schedule_inquiry', 'age_inquiry', 'availability_inquiry', 'general_info', 'recommendation', 'greeting', 'off_topic']).catch('general_info'),
    confidence: z.number().min(0).max(1).catch(0),
    filters: intentFiltersSchema.catch({ age: null, min_age_lte: null, max_age_gte: null, days: null, category_keyword: null, max_price: null, time_period: null, specific_date: null, target_age_group: null, has_spots: null, free_only: null }),
    search_terms: z.array(z.string().max(80)).max(12).nullable().catch(null),
    activity_name: z.string().max(120).nullable().catch(null),
    response_hint: z.string().max(80).nullable().catch(null),
});

export function extractConstraints(text: string): Partial<RecommendationRequest> {
    const lower = text.toLocaleLowerCase('he-IL');
    const numericAgeMatch = lower.match(/(?:בן|בת|גיל)\s*(\d{1,3})\b/);
    const ageMatch = numericAgeMatch ?? (/(?:בן שבע|בת שבע)/.test(lower) ? ['', '7'] : null);
    const parsedAge = ageMatch ? Number(ageMatch[1]) : null;
    const exactAge = parsedAge != null && Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 120 ? parsedAge : null;
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].filter((day) => lower.includes(day));
    const budget = lower.match(/(?:עד|מקסימום|תקציב(?: של)?)\s*(?:₪\s*)?(\d+(?:\.\d+)?)|(?:₪\s*)(\d+(?:\.\d+)?)/);
    const maxPrice = budget ? Number(budget[1] ?? budget[2]) : null;
    const interests = interestsFromText(lower);
    const hardInterests = /רק|אך ורק|בלבד/.test(lower) ? interests : [];
    const targetAgeGroup: AgeGroup | null = lower.includes('קשיש') || lower.includes('גיל שלישי') ? 'seniors'
        : lower.includes('נוער') || lower.includes('מתבגר') ? 'teens'
            : lower.includes('מבוגר') || lower.includes('בשבילי') ? 'adults'
                : lower.includes('ילד') || lower.includes('ילדים') || lower.includes('ילדה') ? 'kids' : null;
    return {
        exactAge,
        targetAgeGroup, interests, hardInterests, days: [...new Set(days)],
        maxPrice: maxPrice != null && maxPrice >= 0 ? maxPrice : null,
        freeOnly: /חינם|בחינם|ללא עלות/.test(lower),
        requiresAvailability: /מקום פנוי|מקומות פנויים|זמינות/.test(lower),
        locationQuery: null, accessibilityNeeds: [], explicitConstraints: [],
    };
}

function filtersToRequest(filters: IntentFilters): Partial<RecommendationRequest> {
    return { exactAge: filters.age, targetAgeGroup: filters.target_age_group, days: filters.days ?? [], maxPrice: filters.max_price, freeOnly: filters.free_only ?? false, requiresAvailability: filters.has_spots ?? false };
}

export function buildRecommendationRequest(message: string, classified: ClassifiedIntent, history: ChatMessage[] = []): RecommendationRequest {
    const userTexts = [...history.filter((item) => item.role === 'user').map((item) => item.content), message];
    const current = extractConstraints(message);
    const historical = userTexts.slice(0, -1).map(extractConstraints);
    const merged = historical.reduce((acc, item) => ({ ...acc, ...Object.fromEntries(Object.entries(item).filter(([, value]) => value != null && (!Array.isArray(value) || value.length > 0))) }), {} as Partial<RecommendationRequest>);
    const fromClassifier = filtersToRequest(classified.filters);
    const result = {
        ...merged,
        ...Object.fromEntries(Object.entries(fromClassifier).filter(([, value]) => value != null && (!Array.isArray(value) || value.length > 0))),
        ...Object.fromEntries(Object.entries(current).filter(([, value]) => value != null && (!Array.isArray(value) || value.length > 0))),
    };
    return {
        exactAge: result.exactAge ?? null,
        targetAgeGroup: result.targetAgeGroup ?? null,
        interests: [...new Set([...(merged.interests ?? []), ...(current.interests ?? [])])],
        hardInterests: [...new Set(current.hardInterests ?? [])],
        days: [...new Set([...(merged.days ?? []), ...(fromClassifier.days ?? []), ...(current.days ?? [])])],
        maxPrice: current.maxPrice ?? fromClassifier.maxPrice ?? merged.maxPrice ?? null,
        freeOnly: current.freeOnly || fromClassifier.freeOnly || merged.freeOnly || false,
        requiresAvailability: current.requiresAvailability || fromClassifier.requiresAvailability || merged.requiresAvailability || false,
        locationQuery: current.locationQuery ?? fromClassifier.locationQuery ?? merged.locationQuery ?? null,
        accessibilityNeeds: [], explicitConstraints: [],
    };
}
