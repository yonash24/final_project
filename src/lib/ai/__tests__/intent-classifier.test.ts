import test from 'node:test';
import assert from 'node:assert/strict';

import { fastClassify, extractActivityNameFromMessage } from '../intent-classifier.ts';

test('extractActivityNameFromMessage strips question phrasing to the bare name', () => {
    assert.equal(extractActivityNameFromMessage('כמה עולה חוג קרמיקה?'), 'קרמיקה');
    assert.equal(extractActivityNameFromMessage('מתי חוג שחמט?'), 'שחמט');
    assert.equal(extractActivityNameFromMessage('מה המחיר של חוג ציור?'), 'ציור');
    assert.equal(extractActivityNameFromMessage('מחיר'), null);
});

test('"list all" phrasing classifies as an unfiltered search_activities request', () => {
    const result = fastClassify('איזה חוגים יש?');
    assert.ok(result);
    assert.equal(result?.intent, 'search_activities');
    assert.equal(result?.filters.age, null);
    assert.equal(result?.filters.category_keyword, null);
    assert.equal(result?.filters.days, null);
});

test('"תראה לי את כל החוגים" also classifies as list-all', () => {
    const result = fastClassify('תראה לי את כל החוגים');
    assert.ok(result);
    assert.equal(result?.intent, 'search_activities');
});

test('a category-only question never forces the recommendation hint', () => {
    const result = fastClassify('איזה חוגי אמנות יש?');
    assert.ok(result);
    assert.equal(result?.intent, 'search_activities');
    assert.notEqual(result?.response_hint, 'recommend');
    assert.equal(result?.filters.category_keyword, 'אמנות');
});

test('price inquiry extracts the activity name into activity_name and search_terms', () => {
    const result = fastClassify('כמה עולה חוג קרמיקה?');
    assert.ok(result);
    assert.equal(result?.intent, 'price_inquiry');
    assert.equal(result?.activity_name, 'קרמיקה');
    assert.deepEqual(result?.search_terms, ['קרמיקה']);
});

test('schedule inquiry extracts the activity name', () => {
    const result = fastClassify('מתי חוג שחמט?');
    assert.ok(result);
    assert.equal(result?.intent, 'schedule_inquiry');
    assert.equal(result?.activity_name, 'שחמט');
});

test('a day+age question without the word "חוג" still classifies as search_activities', () => {
    const result = fastClassify('מה יש לילדים ביום רביעי?');
    assert.ok(result);
    assert.equal(result?.intent, 'search_activities');
    assert.equal(result?.filters.target_age_group, 'kids');
    assert.deepEqual(result?.filters.days, ['רביעי']);
});

test('a vague question with no signal at all falls through to the LLM path', () => {
    assert.equal(fastClassify('מה קורה?'), null);
});
