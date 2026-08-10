import crypto from 'crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { MetaCloudApiProvider } from '../providers/meta-cloud-api.ts';

const baseConfig = {
    meta_phone_number_id: '123456789',
    meta_business_account_id: '987654321',
    meta_template_language: 'he',
    meta_template_names: {
        registration_confirmation: 'registration_confirmation_he',
    },
};

test('MetaCloudApiProvider sends a free-form text reply', async () => {
    const provider = new MetaCloudApiProvider();
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    process.env.META_WHATSAPP_ACCESS_TOKEN = 'meta-token';

    let capturedUrl = '';
    let capturedBody = '';
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.text-1' }] }), { status: 200 });
    };

    try {
        const result = await provider.send({
            channel: 'whatsapp',
            deliveryId: 'delivery-1',
            recipientPhone: '+972501234567',
            body: 'שלום מהמתנ״ס',
            providerConfig: baseConfig,
        });

        assert.equal(result.status, 'sent');
        assert.equal(result.providerMessageId, 'wamid.text-1');
        assert.equal(capturedUrl, 'https://graph.facebook.com/v23.0/123456789/messages');
        assert.deepEqual(JSON.parse(capturedBody), {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '972501234567',
            type: 'text',
            text: { preview_url: false, body: 'שלום מהמתנ״ס' },
        });
    } finally {
        globalThis.fetch = originalFetch;
        if (originalToken === undefined) delete process.env.META_WHATSAPP_ACCESS_TOKEN;
        else process.env.META_WHATSAPP_ACCESS_TOKEN = originalToken;
    }
});

test('MetaCloudApiProvider sends approved template messages with variables', async () => {
    const provider = new MetaCloudApiProvider();
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    process.env.META_WHATSAPP_ACCESS_TOKEN = 'meta-token';
    let capturedBody = '';
    globalThis.fetch = async (_input, init) => {
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.template-1' }] }), { status: 200 });
    };

    try {
        const result = await provider.send({
            channel: 'whatsapp',
            deliveryId: 'delivery-2',
            recipientPhone: '+972501234567',
            body: 'Fallback text',
            templateKey: 'registration_confirmation',
            payload: { name: 'דנה', activity_title: 'יוגה' },
            templateVariables: ['name', 'activity_title'],
            providerConfig: baseConfig,
        });

        assert.equal(result.status, 'sent');
        assert.deepEqual(JSON.parse(capturedBody).template, {
            name: 'registration_confirmation_he',
            language: { code: 'he' },
            components: [{
                type: 'body',
                parameters: [{ type: 'text', text: 'דנה' }, { type: 'text', text: 'יוגה' }],
            }],
        });
    } finally {
        globalThis.fetch = originalFetch;
        if (originalToken === undefined) delete process.env.META_WHATSAPP_ACCESS_TOKEN;
        else process.env.META_WHATSAPP_ACCESS_TOKEN = originalToken;
    }
});

test('MetaCloudApiProvider validates the webhook challenge and signature', async () => {
    const provider = new MetaCloudApiProvider();
    const originalVerifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
    const originalAppSecret = process.env.META_WHATSAPP_APP_SECRET;
    process.env.META_WHATSAPP_VERIFY_TOKEN = 'verify-token';
    process.env.META_WHATSAPP_APP_SECRET = 'app-secret';

    try {
        const challengeRequest = {
            nextUrl: new URL('https://example.com/api/webhooks/whatsapp/meta-cloud-api?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123'),
        } as Parameters<typeof provider.verifyWebhookChallenge>[0];
        const challenge = await provider.verifyWebhookChallenge(challengeRequest);
        assert.equal(challenge.ok, true);
        assert.equal(challenge.responseBody, 'challenge-123');

        const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
        const signature = crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex');
        const request = new Request('https://example.com/api/webhooks/whatsapp/meta-cloud-api', {
            method: 'POST',
            headers: { 'x-hub-signature-256': `sha256=${signature}` },
            body: rawBody,
        });
        const verification = await provider.verifyWebhook({ request, rawBody, url: request.url });
        assert.equal(verification.ok, true);
    } finally {
        if (originalVerifyToken === undefined) delete process.env.META_WHATSAPP_VERIFY_TOKEN;
        else process.env.META_WHATSAPP_VERIFY_TOKEN = originalVerifyToken;
        if (originalAppSecret === undefined) delete process.env.META_WHATSAPP_APP_SECRET;
        else process.env.META_WHATSAPP_APP_SECRET = originalAppSecret;
    }
});

test('MetaCloudApiProvider parses inbound text and delivery status webhooks', async () => {
    const provider = new MetaCloudApiProvider();
    const rawBody = JSON.stringify({
        entry: [{ changes: [{ value: {
            contacts: [{ profile: { name: 'Dana' } }],
            messages: [{ from: '972501234567', id: 'wamid.in-1', text: { body: 'יש חוגים?' }, timestamp: '1700000000' }],
            statuses: [{ id: 'wamid.out-1', status: 'delivered', timestamp: '1700000001' }],
        } }] }],
    });
    const request = new Request('https://example.com/api/webhooks/whatsapp/meta-cloud-api', { method: 'POST' });
    const result = await provider.parseWebhook({ request, rawBody, url: request.url });

    assert.equal(result.inboundMessages[0]?.fromPhone, '+972501234567');
    assert.equal(result.inboundMessages[0]?.text, 'יש חוגים?');
    assert.equal(result.statusEvents[0]?.status, 'delivered');
    assert.equal(result.statusEvents[0]?.providerMessageId, 'wamid.out-1');
});
