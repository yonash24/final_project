import { z } from 'zod';
import { interestsFromText, type ActivityInterest } from './activity-taxonomy.ts';
import type { ClassifiedIntent, ChatMessage, IntentFilters } from './intent-classifier.ts';

export type AgeGroup = 'kids' | 'teens' | 'adults' | 'seniors';

export interface RecommendationRequest {
    exactAge: number | null;
    ageMin?: number | null;
    ageMax?: number | null;
    gradeMin?: number | null;
    gradeMax?: number | null;
    targetAgeGroup: AgeGroup | null;
    interests: readonly ActivityInterest[];
    hardInterests: readonly ActivityInterest[];
    days: readonly string[];
    maxPrice: number | null;
    freeOnly: boolean;
    requiresAvailability: boolean;
    locationQuery: string | null;
    startsAfter?: string | null;
    startsBefore?: string | null;
    endsBefore?: string | null;
    accessibilityNeeds: readonly string[];
    explicitConstraints: readonly string[];
}

const AGE_GROUPS = ['kids', 'teens', 'adults', 'seniors'] as const;
export const intentFiltersSchema = z.object({
    age: z.number().int().min(0).max(120).nullable().catch(null),
    age_min: z.number().int().min(0).max(120).nullable().catch(null),
    age_max: z.number().int().min(0).max(120).nullable().catch(null),
    grade_min: z.number().int().min(0).max(12).nullable().catch(null),
    grade_max: z.number().int().min(0).max(12).nullable().catch(null),
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
    branch: z.string().trim().max(120).nullable().catch(null),
    starts_after: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
    starts_before: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
    ends_before: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
});
export const intentSchema = z.object({
    intent: z.enum(['search_activities', 'search_events', 'activity_details', 'price_inquiry', 'schedule_inquiry', 'age_inquiry', 'availability_inquiry', 'general_info', 'recommendation', 'greeting', 'off_topic']).catch('general_info'),
    confidence: z.number().min(0).max(1).catch(0),
    filters: intentFiltersSchema.catch({ age: null, age_min: null, age_max: null, grade_min: null, grade_max: null, min_age_lte: null, max_age_gte: null, days: null, category_keyword: null, max_price: null, time_period: null, specific_date: null, target_age_group: null, has_spots: null, free_only: null, branch: null, starts_after: null, starts_before: null, ends_before: null }),
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
    const ageRange = lower.match(/(?:גילאי|גילים?|בני)\s*(\d{1,3})\s*(?:עד|-|–)\s*(\d{1,3})/);
    const ageMin = ageRange ? Number(ageRange[1]) : null;
    const ageMax = ageRange ? Number(ageRange[2]) : null;
    const gradeValues: Record<string, number> = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'יא': 11, 'יב': 12 };
    const gradeRange = lower.replace(/[׳״"']/g, '').match(/כית(?:ה|ות)\s+(יא|יב|י|א|ב|ג|ד|ה|ו|ז|ח|ט)(?:\s*(?:עד|-|–)\s*(יא|יב|י|א|ב|ג|ד|ה|ו|ז|ח|ט))?/);
    const gradeMin = gradeRange ? gradeValues[gradeRange[1]] ?? null : null;
    const gradeMax = gradeRange ? gradeValues[gradeRange[2] ?? gradeRange[1]] ?? null : null;
    const branch = lower.match(/בסניף\s+(.+?)(?=\s+ביום|\s+אחרי|\s+לפני|\s+בין|[?.!,]|$)/)?.[1]?.trim() ?? null;
    const after = lower.match(/אחרי\s+(\d{1,2})(?::(\d{2}))?/);
    const before = lower.match(/(?:מתחילים\s+)?לפני\s+(\d{1,2})(?::(\d{2}))?/);
    const between = lower.match(/בין\s+(\d{1,2})(?::(\d{2}))?\s*(?:ל(?:-|־)?|עד|-)\s*(\d{1,2})(?::(\d{2}))?/);
    const asTime = (hours?: string, minutes?: string) => hours ? `${hours.padStart(2, '0')}:${minutes ?? '00'}` : null;
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
        exactAge: ageRange ? null : exactAge,
        targetAgeGroup, interests, hardInterests, days: [...new Set(days)],
        maxPrice: maxPrice != null && maxPrice >= 0 ? maxPrice : null,
        freeOnly: /חינם|בחינם|ללא עלות/.test(lower),
        requiresAvailability: /מקום פנוי|מקומות פנויים|זמינות/.test(lower),
        locationQuery: branch, accessibilityNeeds: [], explicitConstraints: [],
        ageMin, ageMax, gradeMin, gradeMax,
        startsAfter: between ? asTime(between[1], between[2]) : after ? asTime(after[1], after[2]) : null,
        startsBefore: between ? asTime(between[3], between[4]) : null,
        endsBefore: before ? asTime(before[1], before[2]) : null,
    };
}

function filtersToRequest(filters: IntentFilters): Partial<RecommendationRequest> {
    return { exactAge: filters.age, ageMin: filters.age_min, ageMax: filters.age_max, gradeMin: filters.grade_min, gradeMax: filters.grade_max, targetAgeGroup: filters.target_age_group, days: filters.days ?? [], maxPrice: filters.max_price, freeOnly: filters.free_only ?? false, requiresAvailability: filters.has_spots ?? false, locationQuery: filters.branch, startsAfter: filters.starts_after, startsBefore: filters.starts_before, endsBefore: filters.ends_before };
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
        ageMin: result.ageMin ?? null, ageMax: result.ageMax ?? null,
        gradeMin: result.gradeMin ?? null, gradeMax: result.gradeMax ?? null,
        targetAgeGroup: result.targetAgeGroup ?? null,
        interests: [...new Set([...(merged.interests ?? []), ...(current.interests ?? [])])],
        hardInterests: [...new Set(current.hardInterests ?? [])],
        days: [...new Set([...(merged.days ?? []), ...(fromClassifier.days ?? []), ...(current.days ?? [])])],
        maxPrice: current.maxPrice ?? fromClassifier.maxPrice ?? merged.maxPrice ?? null,
        freeOnly: current.freeOnly || fromClassifier.freeOnly || merged.freeOnly || false,
        requiresAvailability: current.requiresAvailability || fromClassifier.requiresAvailability || merged.requiresAvailability || false,
        locationQuery: current.locationQuery ?? fromClassifier.locationQuery ?? merged.locationQuery ?? null,
        startsAfter: current.startsAfter ?? fromClassifier.startsAfter ?? merged.startsAfter ?? null,
        startsBefore: current.startsBefore ?? fromClassifier.startsBefore ?? merged.startsBefore ?? null,
        endsBefore: current.endsBefore ?? fromClassifier.endsBefore ?? merged.endsBefore ?? null,
        accessibilityNeeds: [], explicitConstraints: [],
    };
}
