import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isDuplicateDatabaseError,
    mapDeliveryStatus,
    mapWhatsAppEventType,
} from '../service-helpers.ts';

test('isDuplicateDatabaseError detects Postgres unique violations', () => {
    assert.equal(isDuplicateDatabaseError({ code: '23505' } as never), true);
    assert.equal(isDuplicateDatabaseError({ code: '42703' } as never), false);
    assert.equal(isDuplicateDatabaseError(null), false);
});

test('mapDeliveryStatus normalizes provider lifecycle states', () => {
    assert.equal(mapDeliveryStatus('accepted'), 'sent');
    assert.equal(mapDeliveryStatus('queued'), 'sent');
    assert.equal(mapDeliveryStatus('read'), 'delivered');
    assert.equal(mapDeliveryStatus('undelivered'), 'failed');
});

test('mapWhatsAppEventType maps provider status names to internal event types', () => {
    assert.equal(mapWhatsAppEventType('delivered'), 'provider_delivered');
    assert.equal(mapWhatsAppEventType('read'), 'provider_read');
    assert.equal(mapWhatsAppEventType('failed'), 'provider_failed');
    assert.equal(mapWhatsAppEventType('accepted'), 'provider_accepted');
});
