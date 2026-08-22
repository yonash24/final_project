import type { ActivityRow } from '@/lib/db/chat-queries';
import type { RecommendationRequest } from './recommendation-request';
import { interestLabel, interestsFromText } from './activity-taxonomy';

export interface ActivityRecommendation { activity: ActivityRow; score: number; matchReasons: string[]; warnings: string[]; }
export function rankEligibleActivities(activities: ActivityRow[], request: RecommendationRequest): ActivityRecommendation[] {
    return activities.map((activity) => {
        const text = `${activity.title_he} ${activity.description_he ?? ''} ${activity.categories?.name_he ?? ''}`;
        const matched = request.interests.filter((interest) => interestsFromText(text).includes(interest));
        const reasons = [
            request.exactAge != null ? `מתאים לגיל ${request.exactAge}` : null,
            ...matched.map((interest) => interestLabel(interest)),
            request.days.some((day) => activity.days_of_week?.includes(day) ?? false) ? `מתקיים ביום ${request.days.find((day) => activity.days_of_week?.includes(day))}` : null,
            request.maxPrice != null ? 'בתוך התקציב' : null,
            request.requiresAvailability ? 'יש מקום פנוי' : null,
        ].filter((reason): reason is string => reason != null);
        return { activity, score: matched.length * 3 + (request.exactAge != null ? 2 : 0) + (reasons.includes('בתוך התקציב') ? 1 : 0), matchReasons: reasons, warnings: [] };
    }).sort((a, b) => b.score - a.score || a.activity.title_he.localeCompare(b.activity.title_he, 'he'));
}
