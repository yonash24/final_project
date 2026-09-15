import assert from 'node:assert/strict';
import test from 'node:test';

import { roleHasPermission } from '../permissions.ts';

const hasPermission = (role: string, permission: string) => roleHasPermission(role, permission);

test('viewer can only read activities', () => {
    assert.equal(hasPermission('viewer', 'activity:read'), true);
    assert.equal(hasPermission('viewer', 'activity:update'), false);
});

test('editor can update but cannot create or archive', () => {
    assert.equal(hasPermission('editor', 'activity:update'), true);
    assert.equal(hasPermission('editor', 'activity:create'), false);
    assert.equal(hasPermission('editor', 'activity:archive'), false);
});

test('manager can create, update, archive and restore but cannot publish', () => {
    for (const permission of ['activity:create', 'activity:update', 'activity:archive', 'activity:restore']) {
        assert.equal(hasPermission('manager', permission), true);
    }
    assert.equal(hasPermission('manager', 'activity:publish'), false);
});

test('super admin can publish and manage administrators', () => {
    assert.equal(hasPermission('super_admin', 'activity:publish'), true);
    assert.equal(hasPermission('super_admin', 'admin:write'), true);
});
