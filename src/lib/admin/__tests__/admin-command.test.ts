import assert from 'node:assert/strict';
import test from 'node:test';

import { adminCommandSchema } from '../admin-command-schema.ts';

const base = {
    target_name: null,
    target_selector: {},
    query: null,
    changes: {},
    confidence: 1,
};

test('admin command schema accepts every V1 operation', () => {
    for (const operation of ['query', 'create_draft', 'update', 'archive', 'restore', 'publish', 'cancel', 'list_pending']) {
        assert.equal(adminCommandSchema.parse({ ...base, operation }).operation, operation);
    }
});

test('admin command schema rejects SQL, table names and arbitrary filters', () => {
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', sql: 'DELETE FROM activities' }).success, false);
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', changes: { table: 'activities' } }).success, false);
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', target_selector: { filter: '1=1' } }).success, false);
});

test('admin command schema validates times and age boundaries', () => {
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', changes: { start_time: '17:00', min_age: 6 } }).success, true);
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', changes: { start_time: '5pm' } }).success, false);
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', changes: { start_time: '25:00' } }).success, false);
    assert.equal(adminCommandSchema.safeParse({ ...base, operation: 'update', changes: { min_age: -1 } }).success, false);
});
