import type { ActivityRow, EventRow } from '@/lib/db/chat-queries';
import type { RecommendationRequest } from './recommendation-request';
import { interestsFromText } from './activity-taxonomy';

function dayMatches(value: string | null, days: readonly string[]) { return days.length === 0 || (value != null && days.some((day) => value.includes(day))); }
function ageMatches(min: number | null, max: number | null, request: RecommendationRequest) {
    if (request.exactAge != null) return min != null && max != null && min <= request.exactAge && max >= request.exactAge;
    return request.targetAgeGroup == null || (min != null && max != null);
}
export function isActivityEligible(activity: ActivityRow, request: RecommendationRequest): boolean {
    if (!activity.is_active || !ageMatches(activity.min_age, activity.max_age, request)) return false;
    if (request.exactAge == null && request.targetAgeGroup != null && activity.target_age_group !== request.targetAgeGroup) return false;
    if (!dayMatches(activity.days_of_week, request.days)) return false;
    if (request.maxPrice != null && (activity.price == null || activity.price > request.maxPrice)) return false;
    if (request.freeOnly && activity.price !== 0) return false;
    if (request.requiresAvailability && activity.max_participants != null && (activity.current_participants ?? 0) >= activity.max_participants) return false;
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
