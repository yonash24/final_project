import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

import type { ActivityRow } from '../../db/chat-queries.ts';
import type { ClassifiedIntent } from '../intent-classifier.ts';

function row(overrides: Partial<ActivityRow>): ActivityRow {
    return {
        id: overrides.id ?? 'x', title: 'x', title_he: 'חוג',
        description: null, description_he: null, target_age_group: null,
        min_age: null, max_age: null, days_of_week: null, start_time: null, end_time: null,
        price: null, instructor_name: null, location: null, venue: null, group_name: null,
        max_participants: null, current_participants: null, is_active: true, publication_status: 'approved',
        categories: null, ...overrides,
    };
}

const FIXTURE: ActivityRow[] = [
    row({ id: 'ceramics', title_he: 'חוג קרמיקה', min_age: 8, max_age: 10, days_of_week: 'רביעי', start_time: '17:00:00', end_time: '18:00:00', price: 220, location: 'הלל 18', categories: { name_he: 'אמנות ויצירה' } }),
    row({ id: 'painting-kids', title_he: 'ציור לילדים', min_age: 6, max_age: 9, days_of_week: 'שני', start_time: '16:00:00', end_time: '17:00:00', price: 180, location: 'התאנה 90', categories: { name_he: 'אמנות ויצירה' } }),
    row({ id: 'painting-adults', title_he: 'ציור למבוגרים', min_age: 18, max_age: 99, days_of_week: 'שני', start_time: '19:00:00', end_time: '20:30:00', price: 250, location: 'חדרה', categories: { name_he: 'אמנות ויצירה' } }),
    row({ id: 'chess', title_he: 'שחמט', min_age: 8, max_age: 10, days_of_week: 'שני', start_time: '17:30:00', end_time: '18:30:00', price: 150, location: 'התאנה 90' }),
    row({ id: 'seniors-gym', title_he: 'התעמלות לגיל השלישי', min_age: null, max_age: null, days_of_week: 'שני', start_time: '09:00:00', end_time: '10:00:00', price: 120, location: 'חדרה' }),
    row({ id: 'theater-draft', title_he: 'סדנת תיאטרון', min_age: 7, max_age: 10, days_of_week: 'רביעי', start_time: '18:00:00', end_time: '19:00:00', price: 190, location: 'התאנה 90', is_active: false, publication_status: 'draft' }),
];

function classified(overrides: Partial<ClassifiedIntent>): ClassifiedIntent {
    return {
        intent: 'search_activities', confidence: 0.95,
        filters: {
            age: null, age_min: null, age_max: null, grade_min: null, grade_max: null,
            min_age_lte: null, max_age_gte: null, days: null, category_keyword: null,
            max_price: null, time_period: null, specific_date: null, target_age_group: null,
            has_spots: null, free_only: null, branch: null, starts_after: null, starts_before: null, ends_before: null,
        },
        search_terms: null, activity_name: null, response_hint: null,
        ...overrides,
    };
}

// A single mock.module() registration per specifier for the whole file — the
// experimental module-mock API does not reliably re-intercept a specifier
// that has already been mock()'d and restore()'d once, so each test instead
// mutates this shared cell before calling getChatResponse.
let currentClassified: ClassifiedIntent = classified({});

mock.module('../../db/chat-queries.ts', {
    namedExports: {
        searchActivities: async (_filters: unknown, searchTerms: string[] | null, rawQuery: string | null, options: { broaden?: boolean } = {}) => {
            if (options.broaden === false) {
                const needle = (searchTerms?.join(' ') ?? rawQuery ?? '').trim();
                return FIXTURE.filter((a) => a.is_active && a.publication_status === 'approved' && needle && a.title_he.includes(needle));
            }
            return FIXTURE;
        },
        searchEvents: async () => [],
        getActivitiesByName: async (name: string) => FIXTURE.filter((a) =>
            a.is_active && a.publication_status === 'approved' && a.title_he.includes(name)),
        searchKnowledgeBase: async () => [],
        getCategories: async () => [],
        resolveBranchName: async (input: string) => {
            const known = ['הלל 18', 'התאנה 90', 'חדרה'];
            return known.includes(input) ? { exact: input, suggestions: [] } : { exact: null, suggestions: [] };
        },
    },
});
mock.module('../semantic-search.ts', {
    namedExports: {
        semanticSearchActivities: async () => [],
        semanticSearchKnowledge: async () => [],
        semanticSearchAll: async () => ({ activities: [], events: [], knowledge: [] }),
    },
});
mock.module('../intent-classifier.ts', {
    namedExports: { classifyIntent: async () => currentClassified },
});
mock.module('../gemini.ts', {
    namedExports: { getChatModel: () => ({ generateContent: async () => ({ response: { text: () => 'תשובה כללית מבוססת הקשר.' } }) }) },
});

const { getChatResponse } = await import('../chat-service.ts');

test('a list-all query returns every active, approved activity and hides the draft', async () => {
    currentClassified = classified({});
    const result = await getChatResponse('איזה חוגים יש?', []);
    assert.equal(result.responseType, 'results');
    const titles = result.activityCards.map((a) => a.title_he);
    assert.ok(titles.includes('חוג קרמיקה'));
    assert.equal(titles.includes('סדנת תיאטרון'), false);
});

test('an exact-age question never matches an activity with unknown ages', async () => {
    currentClassified = classified({ filters: { ...classified({}).filters, age: 6, min_age_lte: 6, max_age_gte: 6 } });
    const result = await getChatResponse('יש חוג לילד בן 6?', []);
    assert.equal(result.responseType, 'results');
    const titles = result.activityCards.map((a) => a.title_he);
    assert.ok(titles.includes('ציור לילדים'));
    assert.equal(titles.includes('התעמלות לגיל השלישי'), false, 'an activity with no recorded age range must never be claimed to fit a specific age');
    assert.equal(titles.includes('חוג קרמיקה'), false, 'age 6 is outside קרמיקה\'s 8-10 range');
});

test('an unknown branch name asks for clarification instead of guessing the closest one', async () => {
    currentClassified = classified({ filters: { ...classified({}).filters, branch: 'סניף אטלנטיס' } });
    const result = await getChatResponse('איזה חוגים יש בסניף אטלנטיס?', []);
    assert.equal(result.responseType, 'clarification');
    assert.match(result.response, /לא מצאתי סניף/);
});

test('a price question with exactly one name match answers directly with the real price', async () => {
    currentClassified = classified({ intent: 'price_inquiry', activity_name: 'קרמיקה', search_terms: ['קרמיקה'] });
    const result = await getChatResponse('כמה עולה חוג קרמיקה?', []);
    assert.equal(result.responseType, 'answer');
    assert.match(result.response, /220/);
});

test('a price question matching two activities asks which one instead of guessing', async () => {
    currentClassified = classified({ intent: 'price_inquiry', activity_name: 'ציור', search_terms: ['ציור'] });
    const result = await getChatResponse('כמה עולה חוג ציור?', []);
    assert.equal(result.responseType, 'clarification');
    assert.equal(result.activityCards.length, 2);
});

test('a nonexistent activity name returns a plain "not found" answer with zero cards', async () => {
    currentClassified = classified({ intent: 'price_inquiry', activity_name: 'טניס', search_terms: ['טניס'] });
    const result = await getChatResponse('כמה עולה חוג טניס?', []);
    assert.equal(result.responseType, 'answer');
    assert.equal(result.resultCount, 0);
});

test('a draft activity is never surfaced to a public chat question, even by exact name', async () => {
    currentClassified = classified({ intent: 'activity_details', activity_name: 'סדנת תיאטרון', search_terms: ['סדנת תיאטרון'] });
    const result = await getChatResponse('ספר לי על סדנת תיאטרון', []);
    assert.equal(result.resultCount, 0);
});

test('a category with zero eligible matches asks for an age instead of claiming there is nothing at all', async () => {
    currentClassified = classified({ filters: { ...classified({}).filters, category_keyword: 'יוגה' } });
    const result = await getChatResponse('אילו חוגי יוגה יש?', []);
    assert.equal(result.responseType, 'clarification');
    assert.match(result.response, /גיל/);
});

test('low classifier confidence asks for clarification rather than guessing the intent', async () => {
    currentClassified = classified({ confidence: 0.2 });
    const result = await getChatResponse('משהו', []);
    assert.equal(result.responseType, 'clarification');
});
