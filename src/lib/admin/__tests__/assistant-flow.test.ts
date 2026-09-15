import test from 'node:test';
import assert from 'node:assert/strict';

import { runAdminAssistant, type AssistantDeps } from '../assistant-flow.ts';
import type { AdminCommand } from '../admin-command-schema.ts';
import type { AdminProfile } from '../auth.ts';
import type { ActivityRow } from '../../db/chat-queries.ts';

const PROFILE: AdminProfile = { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', role: 'super_admin', is_active: true };

function activity(id: string, overrides: Partial<ActivityRow> = {}): ActivityRow {
    return {
        id, title: 'x', title_he: `חוג ${id}`, description: null, description_he: null,
        target_age_group: null, min_age: null, max_age: null, days_of_week: 'רביעי',
        start_time: '17:00', end_time: '18:00', price: 100, instructor_name: null,
        location: 'הלל 18', max_participants: null, current_participants: null,
        is_active: true, publication_status: 'approved', categories: null,
        ...overrides,
    };
}

function command(overrides: Partial<AdminCommand> = {}): AdminCommand {
    return {
        operation: 'update',
        target_name: null,
        target_selector: { activity_id: null, name: null, branch: null, day: null, start_time: null, end_time: null, age: null, group_name: null },
        query: null,
        changes: {},
        confidence: 0.9,
        ...overrides,
    };
}

interface Recorder {
    proposeCalls: unknown[];
    cancelCalls: unknown[];
}

function makeDeps(overrides: Partial<AssistantDeps> = {}, recorder: Recorder = { proposeCalls: [], cancelCalls: [] }): AssistantDeps {
    return {
        parseCommand: async () => command(),
        resolveSelector: async () => [],
        propose: async (args) => {
            recorder.proposeCalls.push(args);
            return {
                responseType: 'confirmation', response: 'הפעולה טרם בוצעה.', target: null, operation: args.operation,
                changes: (args.changes as Record<string, unknown>) ?? {}, token: 'tok', requestId: 'req-1',
                riskLevel: 'medium', approvalMethod: 'web_token', expiresInSeconds: 600,
            };
        },
        cancel: async (args) => { recorder.cancelCalls.push(args); return { response: 'בוטלה', requestId: args.requestId }; },
        listPending: async () => [],
        hasPermission: () => true,
        ...overrides,
    };
}

test('ambiguous target returns a clarification with candidate cards and never proposes', async () => {
    const recorder: Recorder = { proposeCalls: [], cancelCalls: [] };
    const matches = [activity('a'), activity('b'), activity('c')];
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'archive', target_selector: { activity_id: null, name: null, branch: null, day: 'רביעי', start_time: '17:00', end_time: '18:00', age: null, group_name: null } }),
        resolveSelector: async () => matches,
    }, recorder);
    const result = await runAdminAssistant({ message: 'מחק את החוג של יום רביעי 17:00', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.equal((result.body.activityCards as unknown[]).length, 3);
    assert.equal(recorder.proposeCalls.length, 0);
});

test('a selectedActivityId forces the selector to that id only and proposes directly', async () => {
    const recorder: Recorder = { proposeCalls: [], cancelCalls: [] };
    const selectedId = '11111111-1111-1111-1111-111111111111';
    const target = activity(selectedId);
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'archive', confidence: 0.2, target_selector: { activity_id: null, name: null, branch: null, day: 'רביעי', start_time: '17:00', end_time: '18:00', age: null, group_name: null } }),
        resolveSelector: async (selector) => {
            assert.equal(selector.activity_id, selectedId);
            assert.equal(selector.day, null);
            return [target];
        },
    }, recorder);
    const result = await runAdminAssistant({ message: 'מחק', selectedActivityId: selectedId, profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'confirmation');
    assert.equal(recorder.proposeCalls.length, 1);
    assert.equal((recorder.proposeCalls[0] as { activityId: string }).activityId, selectedId);
});

test('an invalid (non-uuid) selectedActivityId is ignored', async () => {
    const deps = makeDeps({
        resolveSelector: async (selector) => { assert.notEqual(selector.activity_id, 'not-a-uuid'); return []; },
    });
    const result = await runAdminAssistant({ message: 'שנה משהו', selectedActivityId: 'not-a-uuid', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
});

test('update with no identifying selector fields asks what to change instead of guessing', async () => {
    const deps = makeDeps();
    const result = await runAdminAssistant({ message: 'שנה את המחיר ל-100', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.match(result.body.response as string, /איזה חוג/);
});

test('a target that does not exist returns "not found" without proposing', async () => {
    const recorder: Recorder = { proposeCalls: [], cancelCalls: [] };
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'update', target_selector: { activity_id: null, name: 'טניס', branch: null, day: null, start_time: null, end_time: null, age: null, group_name: null }, changes: { price: 100 } }),
        resolveSelector: async () => [],
    }, recorder);
    const result = await runAdminAssistant({ message: 'שנה את מחיר חוג טניס ל-100', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.match(result.body.response as string, /לא נמצא חוג/);
    assert.equal(recorder.proposeCalls.length, 0);
});

test('create_draft without a title asks for one', async () => {
    const deps = makeDeps({ parseCommand: async () => command({ operation: 'create_draft', changes: {} }) });
    const result = await runAdminAssistant({ message: 'צור חוג חדש', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.match(result.body.response as string, /שם חוג/);
});

test('low confidence with exactly one match asks for confirmation rather than proposing', async () => {
    const recorder: Recorder = { proposeCalls: [], cancelCalls: [] };
    const target = activity('a');
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'update', confidence: 0.4, target_selector: { activity_id: null, name: 'קרמיקה', branch: null, day: null, start_time: null, end_time: null, age: null, group_name: null }, changes: { price: 100 } }),
        resolveSelector: async () => [target],
    }, recorder);
    const result = await runAdminAssistant({ message: 'תעדכן את המחיר', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.equal((result.body.activityCards as unknown[]).length, 1);
    assert.equal(recorder.proposeCalls.length, 0);
});

test('cancel with zero pending changes says there is nothing to cancel', async () => {
    const deps = makeDeps({ parseCommand: async () => command({ operation: 'cancel' }), listPending: async () => [] });
    const result = await runAdminAssistant({ message: 'בטל את הפעולה', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'answer');
    assert.match(result.body.response as string, /אין פעולות/);
});

test('cancel with exactly one pending change cancels it', async () => {
    const recorder: Recorder = { proposeCalls: [], cancelCalls: [] };
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'cancel' }),
        listPending: async () => [{ id: 'req-1', operation: 'update', activity_id: 'a', proposed_changes: {}, before_snapshot: null, approval_method: 'web_token', expires_at: new Date().toISOString() }],
    }, recorder);
    const result = await runAdminAssistant({ message: 'בטל את הפעולה', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'answer');
    assert.equal(recorder.cancelCalls.length, 1);
});

test('cancel with more than one pending change asks which one', async () => {
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'cancel' }),
        listPending: async () => [
            { id: 'req-1', operation: 'update', activity_id: 'a', proposed_changes: {}, before_snapshot: null, approval_method: 'web_token', expires_at: new Date().toISOString() },
            { id: 'req-2', operation: 'archive', activity_id: 'b', proposed_changes: {}, before_snapshot: null, approval_method: 'web_mfa', expires_at: new Date().toISOString() },
        ],
    });
    const result = await runAdminAssistant({ message: 'בטל', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'clarification');
    assert.equal((result.body.pendingChanges as unknown[]).length, 2);
});

test('list_pending reports the pending count', async () => {
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'list_pending' }),
        listPending: async () => [{ id: 'req-1', operation: 'update', activity_id: 'a', proposed_changes: {}, before_snapshot: null, approval_method: 'web_token', expires_at: new Date().toISOString() }],
    });
    const result = await runAdminAssistant({ message: 'הצג פעולות ממתינות', profile: PROFILE }, deps);
    assert.equal(result.body.responseType, 'answer');
    assert.equal((result.body.pendingChanges as unknown[]).length, 1);
});

test('a write operation without permission is denied with 403', async () => {
    const deps = makeDeps({
        parseCommand: async () => command({ operation: 'archive', target_selector: { activity_id: null, name: 'x', branch: null, day: null, start_time: null, end_time: null, age: null, group_name: null } }),
        hasPermission: () => false,
    });
    const result = await runAdminAssistant({ message: 'מחק את חוג x', profile: PROFILE }, deps);
    assert.equal(result.status, 403);
});

test('a parse failure surfaces as a 503 system_error, not a crash', async () => {
    const deps = makeDeps({ parseCommand: async () => { throw new Error('gemini down'); } });
    const result = await runAdminAssistant({ message: 'שנה משהו', profile: PROFILE }, deps);
    assert.equal(result.status, 503);
    assert.equal(result.body.responseType, 'system_error');
});
