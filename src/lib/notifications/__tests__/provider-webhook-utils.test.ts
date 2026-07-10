import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEffectiveWebhookUrl } from '../provider-webhook-utils.ts';

test('buildEffectiveWebhookUrl prefers forwarded host and protocol when present', () => {
    const headers = new Headers({
        'x-forwarded-host': 'public.example.com',
        'x-forwarded-proto': 'https',
    });

    const url = buildEffectiveWebhookUrl('http://internal:3000/api/webhooks/whatsapp/twilio-whatsapp?foo=bar', headers);

    assert.equal(url, 'https://public.example.com/api/webhooks/whatsapp/twilio-whatsapp?foo=bar');
});

test('buildEffectiveWebhookUrl falls back to the raw request url', () => {
    const url = buildEffectiveWebhookUrl('https://example.com/api/webhooks/whatsapp/meta-cloud-api', new Headers());

    assert.equal(url, 'https://example.com/api/webhooks/whatsapp/meta-cloud-api');
});
