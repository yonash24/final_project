import type { ActivityRow, EventRow } from '@/lib/db/chat-queries';
import type { RecommendationRequest } from './recommendation-request.ts';
import { interestsFromText } from './activity-taxonomy.ts';

const DAY_NUMBERS: Record<string, number> = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
function ageMatches(min: number | null, max: number | null, request: RecommendationRequest) {
    if (request.exactAge != null) return min != null && max != null && min <= request.exactAge && max >= request.exactAge;
    if (request.ageMin != null || request.ageMax != null) {
        return min != null && max != null
            && (request.ageMin == null || min <= request.ageMin)
            && (request.ageMax == null || max >= request.ageMax);
    }
    return true;
}
function normalized(value: string) { return value.trim().toLocaleLowerCase('he-IL').replace(/["'׳״]/g, '').replace(/\s+/g, ' '); }
function scheduleMatches(activity: ActivityRow, request: RecommendationRequest) {
    const schedules = activity.activity_schedules?.length
        ? activity.activity_schedules
        : [{ day_of_week: null, start_time: activity.start_time, end_time: activity.end_time }];
    return schedules.some((schedule) => {
        const dayOk = request.days.length === 0 || request.days.some((day) =>
            activity.days_of_week?.includes(day) || schedule.day_of_week === DAY_NUMBERS[day]);
        const start = schedule.start_time?.slice(0, 5) ?? null;
        const end = schedule.end_time?.slice(0, 5) ?? null;
        return dayOk
            && (request.startsAfter == null || (start != null && (request.startsAfterExclusive ? start > request.startsAfter : start >= request.startsAfter)))
            && (request.startsBefore == null || (start != null && start <= request.startsBefore))
            && (request.endsBefore == null || (end != null && end <= request.endsBefore));
    });
}
export function isActivityEligible(activity: ActivityRow, request: RecommendationRequest): boolean {
    if (!activity.is_active || (activity.publication_status != null && activity.publication_status !== 'approved') || !ageMatches(activity.min_age, activity.max_age, request)) return false;
    if (request.exactAge == null && request.targetAgeGroup != null && activity.target_age_group !== request.targetAgeGroup) return false;
    if (!scheduleMatches(activity, request)) return false;
    if (request.gradeMin != null || request.gradeMax != null) {
        if (activity.min_grade == null || activity.max_grade == null) return false;
        if (request.gradeMin != null && activity.min_grade > request.gradeMin) return false;
        if (request.gradeMax != null && activity.max_grade < request.gradeMax) return false;
    }
    if (request.locationQuery) {
        const requested = normalized(request.locationQuery);
        const candidates = [activity.branches?.name, activity.location, activity.venue, ...(activity.branches?.branch_aliases?.map((item) => item.alias) ?? [])]
            .filter((value): value is string => Boolean(value)).map(normalized);
        if (!candidates.some((value) => value === requested)) return false;
    }
    if (request.maxPrice != null && (activity.price == null || activity.price > request.maxPrice)) return false;
    if (request.freeOnly && activity.price !== 0) return false;
    if (request.requiresAvailability && (activity.max_participants == null || (activity.current_participants ?? 0) >= activity.max_participants)) return false;
    if (request.hardInterests.length > 0) {
        const activityInterests = interestsFromText(`${activity.title_he} ${activity.description_he ?? ''} ${activity.categories?.name_he ?? ''}`);
        if (!request.hardInterests.some((interest) => activityInterests.includes(interest))) return false;
    }
    return true;
}
export function isEventEligible(event: EventRow, request: RecommendationRequest, today = new Date().toISOString().slice(0, 10)): boolean {
    if (!event.is_published || event.event_date < today) return false;
    if (request.exactAge != null) return event.min_age != null && event.max_age != null && event.min_age <= request.exactAge && event.max_age >= request.exactAge;
    return request.targetAgeGroup == null || (event.min_age != null && event.max_age != null && event.target_age_group === request.targetAgeGroup);
}
