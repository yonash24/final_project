import test from 'node:test';
import assert from 'node:assert/strict';

import { isAuthorizedCronRequest } from '../cron-auth.ts';

test('isAuthorizedCronRequest accepts the configured bearer secret', () => {
    const previous = process.env.NOTIFICATIONS_CRON_SECRET;
    process.env.NOTIFICATIONS_CRON_SECRET = 'test-cron-secret';

    try {
        const request = new Request('https://example.com/api/notifications/process', {
            headers: { authorization: 'Bearer test-cron-secret' },
        });
        assert.equal(isAuthorizedCronRequest(request), true);
    } finally {
        process.env.NOTIFICATIONS_CRON_SECRET = previous;
    }
});

test('isAuthorizedCronRequest accepts the custom header secret', () => {
    const previous = process.env.NOTIFICATIONS_CRON_SECRET;
    process.env.NOTIFICATIONS_CRON_SECRET = 'test-cron-secret';

    try {
        const request = new Request('https://example.com/api/notifications/process', {
            headers: { 'x-cron-secret': 'test-cron-secret' },
        });
        assert.equal(isAuthorizedCronRequest(request), true);
    } finally {
        process.env.NOTIFICATIONS_CRON_SECRET = previous;
    }
});

test('isAuthorizedCronRequest rejects missing and incorrect secrets', () => {
    const previous = process.env.NOTIFICATIONS_CRON_SECRET;
    process.env.NOTIFICATIONS_CRON_SECRET = 'test-cron-secret';

    try {
        assert.equal(isAuthorizedCronRequest(new Request('https://example.com')), false);
        assert.equal(isAuthorizedCronRequest(new Request('https://example.com', {
            headers: { authorization: 'Bearer wrong-secret' },
        })), false);
    } finally {
        process.env.NOTIFICATIONS_CRON_SECRET = previous;
    }
});
