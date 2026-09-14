import test from 'node:test';
import assert from 'node:assert/strict';

import { isAdminAuthBypassEnabled } from '../bypass.ts';

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const originals: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
        originals[key] = process.env[key];
        if (vars[key] === undefined) delete process.env[key];
        else process.env[key] = vars[key];
    }

    try {
        fn();
    } finally {
        for (const key of Object.keys(originals)) {
            if (originals[key] === undefined) delete process.env[key];
            else process.env[key] = originals[key];
        }
    }
}

test('isAdminAuthBypassEnabled throws when the bypass is enabled in production', () => {
    withEnv({ ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'production' }, () => {
        assert.throws(() => isAdminAuthBypassEnabled());
    });
});

test('isAdminAuthBypassEnabled returns true when enabled outside production', () => {
    withEnv({ ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'development' }, () => {
        assert.equal(isAdminAuthBypassEnabled(), true);
    });
});

test('isAdminAuthBypassEnabled returns false when not enabled', () => {
    withEnv({ ADMIN_AUTH_BYPASS: undefined, NODE_ENV: 'production' }, () => {
        assert.equal(isAdminAuthBypassEnabled(), false);
    });
});
