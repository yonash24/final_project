import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSearchTokens,
    type ActivitySearchRow,
    type EventSearchRow,
    rankActivities,
    rankEvents,
} from '../chat-search-utils.ts';
import type { IntentFilters } from '../chat-search-utils.ts';

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

function makeActivity(overrides: Partial<ActivitySearchRow> & {
    id?: string;
    title?: string;
    description?: string | null;
    is_active?: boolean;
}): ActivitySearchRow & { title?: string; description?: string | null; is_active?: boolean } {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        title: overrides.title ?? 'חוג',
        title_he: overrides.title_he ?? overrides.title ?? 'חוג',
        description_he: overrides.description_he ?? null,
        target_age_group: overrides.target_age_group ?? null,
        min_age: overrides.min_age ?? null,
        max_age: overrides.max_age ?? null,
        days_of_week: overrides.days_of_week ?? null,
        price: overrides.price ?? null,
        instructor_name: overrides.instructor_name ?? null,
        location: overrides.location ?? null,
        max_participants: overrides.max_participants ?? null,
        current_participants: overrides.current_participants ?? null,
        categories: overrides.categories ?? null,
    };
}

function makeEvent(overrides: Partial<EventSearchRow> & {
    id?: string;
    title?: string;
}): EventSearchRow {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        title: overrides.title ?? 'אירוע',
        description: overrides.description ?? null,
        event_date: overrides.event_date ?? '2026-08-05',
        location: overrides.location ?? null,
        category: overrides.category ?? null,
    };
}

test('buildSearchTokens strips stopwords and normalizes Hebrew prefixes', () => {
    const tokens = buildSearchTokens('יש חוגים לילדים?', null);

    assert.deepEqual(tokens, ['חוגים', 'ילדים']);
});

test('rankActivities prefers title and category matches over unrelated rows', () => {
    const rows = [
        makeActivity({ id: 'title-match', title_he: 'חוג ציור לילדים', categories: { name_he: 'אמנות' } }),
        makeActivity({ id: 'category-match', title_he: 'חוג יצירה', categories: { name_he: 'ציור' } }),
        makeActivity({ id: 'unrelated', title_he: 'חוג כדורגל', categories: { name_he: 'ספורט' } }),
    ];

    const ranked = rankActivities(rows, ['ציור'], EMPTY_FILTERS);

    assert.equal(ranked[0].id, 'title-match');
    assert.equal(ranked[1].id, 'category-match');
    assert.equal(ranked[2].id, 'unrelated');
});

test('rankEvents prefers direct text matches', () => {
    const rows = [
        makeEvent({ id: 'title-match', title: 'סדנת ציור להורים וילדים', category: 'אמנות' }),
        makeEvent({ id: 'location-match', title: 'ערב קהילה', location: 'סטודיו ציור' }),
        makeEvent({ id: 'unrelated', title: 'מפגש ספורט', category: 'ספורט' }),
    ];

    const ranked = rankEvents(rows, ['ציור'], EMPTY_FILTERS);

    assert.equal(ranked[0].id, 'title-match');
    assert.equal(ranked[1].id, 'location-match');
    assert.equal(ranked[2].id, 'unrelated');
});
