import test from 'node:test';
import assert from 'node:assert/strict';
import { extractConstraints, buildRecommendationRequest, intentSchema } from '../recommendation-request.ts';
import { isActivityEligible } from '../eligibility.ts';
import { rankEligibleActivities } from '../recommendation-ranker.ts';
import type { ActivityRow } from '../../db/chat-queries.ts';

function activity(overrides: Partial<ActivityRow> = {}): ActivityRow {
    return { id: 'a', title: 'Activity', title_he: 'פעילות', description: null, description_he: 'יצירה', target_age_group: 'kids', min_age: 6, max_age: 12, days_of_week: 'שלישי', start_time: null, end_time: null, price: 100, instructor_name: null, location: null, max_participants: 10, current_participants: 1, is_active: true, categories: { name_he: 'אמנות' }, ...overrides };
}

test('extracts Hebrew age, creative interest and Tuesday', () => {
    const result = extractConstraints('חוג יצירתי לילדה בת 7 ביום שלישי');
    assert.equal(result.exactAge, 7);
    assert.deepEqual(result.interests, ['creative']);
    assert.deepEqual(result.days, ['שלישי']);
});

test('exact age is a hard eligibility constraint', () => {
    const request = { exactAge: 7, targetAgeGroup: 'kids', interests: [], hardInterests: [], days: [], maxPrice: null, freeOnly: false, requiresAvailability: false, locationQuery: null, accessibilityNeeds: [], explicitConstraints: [] } as const;
    assert.equal(isActivityEligible(activity({ min_age: 18, max_age: 80 }), request), false);
    assert.equal(isActivityEligible(activity(), request), true);
    assert.equal(isActivityEligible(activity({ min_age: null, max_age: null }), request), false);
});

test('hard category, price, day and availability constraints are preserved', () => {
    const request = { exactAge: 7, targetAgeGroup: 'kids', interests: ['creative'], hardInterests: ['creative'], days: ['שלישי'], maxPrice: 150, freeOnly: false, requiresAvailability: true, locationQuery: null, accessibilityNeeds: [], explicitConstraints: [] } as const;
    assert.equal(isActivityEligible(activity(), request), true);
    assert.equal(isActivityEligible(activity({ price: 200 }), request), false);
    assert.equal(isActivityEligible(activity({ days_of_week: 'חמישי' }), request), false);
    assert.equal(isActivityEligible(activity({ current_participants: 10 }), request), false);
    assert.equal(isActivityEligible(activity({ title_he: 'כדורגל', description_he: 'ספורט', categories: { name_he: 'ספורט' } }), request), false);
});

test('conversation keeps an age and a new explicit age replaces it', () => {
    const first = { intent: 'search_activities', confidence: 1, filters: { age: 7, min_age_lte: 7, max_age_gte: 7, days: null, category_keyword: null, max_price: null, time_period: null, specific_date: null, target_age_group: 'kids', has_spots: null, free_only: null }, search_terms: null, activity_name: null, response_hint: null } as const;
    assert.equal(buildRecommendationRequest('משהו יצירתי ביום שלישי', first, [{ role: 'user', content: 'אני מחפש חוג לילדה בת 7' }]).exactAge, 7);
    const second = { ...first, filters: { ...first.filters, age: 35, min_age_lte: 35, max_age_gte: 35, target_age_group: 'adults' } } as const;
    assert.equal(buildRecommendationRequest('עכשיו בשבילי, אני בן 35', second, [{ role: 'user', content: 'אני מחפש חוג לילדה בת 7' }]).exactAge, 35);
});

test('malformed classifier output receives safe defaults', () => {
    const parsed = intentSchema.parse({ intent: 'not-real', filters: { age: -4, max_price: -1 } });
    assert.equal(parsed.intent, 'general_info');
    assert.equal(parsed.filters.age, null);
    assert.equal(parsed.filters.max_price, null);
});

test('reasons are deterministic and factual', () => {
    const request = { exactAge: 7, targetAgeGroup: 'kids', interests: ['creative'], hardInterests: [], days: ['שלישי'], maxPrice: 150, freeOnly: false, requiresAvailability: false, locationQuery: null, accessibilityNeeds: [], explicitConstraints: [] } as const;
    const [result] = rankEligibleActivities([activity()], request);
    assert.deepEqual(result.matchReasons, ['מתאים לגיל 7', 'יצירה ואמנות', 'מתקיים ביום שלישי', 'בתוך התקציב']);
});

test('age range, time, and branch are hard constraints and missing data never matches', () => {
    const request = {
        exactAge: null, ageMin: 8, ageMax: 10, gradeMin: null, gradeMax: null,
        targetAgeGroup: 'kids', interests: [], hardInterests: [], days: ['רביעי'],
        maxPrice: null, freeOnly: false, requiresAvailability: false,
        locationQuery: 'מרכז', startsAfter: '17:00', startsBefore: '18:00', endsBefore: null,
        accessibilityNeeds: [], explicitConstraints: [],
    } as const;
    const matching = activity({ min_age: 6, max_age: 12, days_of_week: 'רביעי', start_time: '17:30', location: 'מרכז' });
    assert.equal(isActivityEligible(matching, request), true);
    assert.equal(isActivityEligible({ ...matching, min_age: null }, request), false);
    assert.equal(isActivityEligible({ ...matching, start_time: null }, request), false);
    assert.equal(isActivityEligible({ ...matching, location: null }, request), false);
    assert.equal(isActivityEligible({ ...matching, start_time: '18:30' }, request), false);
});

test('extracts explicit age and time ranges without inventing vague periods', () => {
    const explicit = extractConstraints('חוג לגילאי 8 עד 10 ביום רביעי בין 16:00 ל-18:00 בסניף מרכז');
    assert.equal(explicit.ageMin, 8);
    assert.equal(explicit.ageMax, 10);
    assert.equal(explicit.startsAfter, '16:00');
    assert.equal(explicit.startsBefore, '18:00');
    const vague = extractConstraints('מה יש בערב?');
    assert.equal(vague.startsAfter, null);
});

test('keeps start-before and end-before semantics distinct', () => {
    const starts = extractConstraints('איזה חוגים מתחילים לפני 19:00?');
    assert.equal(starts.startsBefore, '19:00');
    assert.equal(starts.endsBefore, null);

    const ends = extractConstraints('איזה חוגים מסתיימים לפני 19:00?');
    assert.equal(ends.endsBefore, '19:00');
    assert.equal(ends.startsBefore, null);
});

test('after is exclusive and explicit interests are hard constraints', () => {
    const parsed = extractConstraints('איזה חוגי ספורט יש אחרי 17:00?');
    assert.equal(parsed.startsAfter, '17:00');
    assert.equal(parsed.startsAfterExclusive, true);
    assert.deepEqual(parsed.hardInterests, ['sports']);

    const request = {
        exactAge: null, targetAgeGroup: null, interests: ['sports'], hardInterests: ['sports'], days: [],
        maxPrice: null, freeOnly: false, requiresAvailability: false, locationQuery: 'מרכז',
        startsAfter: '17:00', startsAfterExclusive: true, startsBefore: null, endsBefore: null,
        accessibilityNeeds: [], explicitConstraints: [],
    } as const;
    assert.equal(isActivityEligible(activity({ start_time: '17:00', location: 'מרכז', title_he: 'ציור', description_he: 'אמנות', categories: { name_he: 'אמנות' } }), request), false);
    assert.equal(isActivityEligible(activity({ start_time: '17:01', location: 'מרכז', title_he: 'כדורגל', description_he: 'ספורט', categories: { name_he: 'ספורט' } }), request), true);
});
