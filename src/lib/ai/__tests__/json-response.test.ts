import test from 'node:test';
import assert from 'node:assert/strict';

import { parseJsonObjectResponse } from '../json-response.ts';

test('parseJsonObjectResponse parses plain JSON', () => {
    const parsed = parseJsonObjectResponse<{ intent: string }>('{"intent":"general_info"}');

    assert.equal(parsed.intent, 'general_info');
});

test('parseJsonObjectResponse strips fenced JSON blocks', () => {
    const parsed = parseJsonObjectResponse<{ intent: string }>('```json\n{"intent":"greeting"}\n```');

    assert.equal(parsed.intent, 'greeting');
});

test('parseJsonObjectResponse recovers the first JSON object from noisy model text', () => {
    const parsed = parseJsonObjectResponse<{ intent: string }>('Here is the result:\n{"intent":"search_events"}\nHope that helps.');

    assert.equal(parsed.intent, 'search_events');
});
