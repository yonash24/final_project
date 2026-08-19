import crypto from 'crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { TwilioWhatsAppProvider } from '../providers/twilio-whatsapp.ts';

test('TwilioWhatsAppProvider.send submits the WhatsApp payload and callback', async () => {
    const provider = new TwilioWhatsAppProvider();
    const originalFetch = globalThis.fetch;
    const originalEnv = {
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        APP_BASE_URL: process.env.APP_BASE_URL,
    };

    let capturedUrl = '';
    let capturedBody = '';
    let capturedHeaders: Record<string, string> = {};

    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret-token';
    process.env.APP_BASE_URL = 'https://example.com';

    globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body ?? '');
        capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
        return new Response(JSON.stringify({ sid: 'SM123' }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
        });
    };

    try {
        const result = await provider.send({
            channel: 'whatsapp',
            deliveryId: 'delivery-1',
            recipientPhone: '+972501234567',
            body: 'Hello world',
        providerConfig: {
            twilio_from_number: 'whatsapp:+14155238886',
            status_callback_url: 'https://public.example.com/api/webhooks/whatsapp',
            twilio_content_sids: {
                registration_confirmation: 'HXregistration123',
            },
        },
        });

        assert.equal(result.status, 'sent');
        assert.equal(result.providerMessageId, 'SM123');
        assert.equal(capturedUrl, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
        assert.ok(capturedBody.includes('To=whatsapp%3A%2B972501234567'));
        assert.ok(capturedBody.includes('From=whatsapp%3A%2B14155238886'));
        assert.ok(capturedBody.includes('Body=Hello+world'));
        assert.equal(capturedHeaders.authorization?.startsWith('Basic '), true);
        assert.equal(capturedHeaders['content-type'], 'application/x-www-form-urlencoded');
        assert.ok(capturedBody.includes('StatusCallback=https%3A%2F%2Fpublic.example.com%2Fapi%2Fwebhooks%2Fwhatsapp%2Ftwilio-whatsapp'));
    } finally {
        globalThis.fetch = originalFetch;
        process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
        process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
        process.env.APP_BASE_URL = originalEnv.APP_BASE_URL;
    }
});

test('TwilioWhatsAppProvider.send uses a configured Content SID for template messages', async () => {
    const provider = new TwilioWhatsAppProvider();
    const originalFetch = globalThis.fetch;
    const originalEnv = {
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    };

    let capturedBody = '';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret-token';
    globalThis.fetch = async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ sid: 'SM456' }), { status: 201 });
    };

    try {
        const result = await provider.send({
            channel: 'whatsapp',
            deliveryId: 'delivery-template-1',
            recipientPhone: '+972501234567',
            body: 'Fallback body',
            templateKey: 'registration_confirmation',
            payload: {
                name: 'Dana',
                activity_title: 'Yoga',
            },
            templateVariables: ['name', 'activity_title'],
            providerConfig: {
                twilio_from_number: 'whatsapp:+14155238886',
                twilio_content_sids: {
                    registration_confirmation: 'HXregistration123',
                },
            },
        });

        assert.equal(result.status, 'sent');
        assert.ok(capturedBody.includes('ContentSid=HXregistration123'));
        assert.ok(capturedBody.includes('ContentVariables=%7B%221%22%3A%22Dana%22%2C%222%22%3A%22Yoga%22%7D'));
        assert.equal(capturedBody.includes('Body='), false);
    } finally {
        globalThis.fetch = originalFetch;
        process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
        process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    }
});

test('TwilioWhatsAppProvider.verifyWebhook accepts a valid signature', async () => {
    const provider = new TwilioWhatsAppProvider();
    const originalEnv = process.env.TWILIO_AUTH_TOKEN;
    process.env.TWILIO_AUTH_TOKEN = 'webhook-secret';

    try {
        const rawBody = 'From=whatsapp%3A%2B972501234567&Body=Hello';
        const request = new Request('https://example.com/api/webhooks/whatsapp/twilio-whatsapp', {
            method: 'POST',
            headers: new Headers({
                'content-type': 'application/x-www-form-urlencoded',
                'x-twilio-signature': buildTwilioSignature('https://example.com/api/webhooks/whatsapp/twilio-whatsapp', rawBody, 'webhook-secret'),
            }),
            body: rawBody,
        });

        const result = await provider.verifyWebhook({
            request,
            rawBody,
            url: request.url,
        });

        assert.equal(result.ok, true);
    } finally {
        process.env.TWILIO_AUTH_TOKEN = originalEnv;
    }
});

test('TwilioWhatsAppProvider.verifyWebhook uses the forwarded public URL and rejects invalid signatures', async () => {
    const provider = new TwilioWhatsAppProvider();
    const originalToken = process.env.TWILIO_AUTH_TOKEN;
    process.env.TWILIO_AUTH_TOKEN = 'webhook-secret';
    const rawBody = 'MessageSid=SM123&Body=Hello';
    const publicUrl = 'https://public.example.com/api/webhooks/whatsapp/twilio-whatsapp?tenant=one';

    try {
        const request = new Request('http://internal:3000/api/webhooks/whatsapp/twilio-whatsapp?tenant=one', {
            method: 'POST',
            headers: {
                'x-forwarded-host': 'public.example.com',
                'x-forwarded-proto': 'https',
                'x-twilio-signature': buildTwilioSignature(publicUrl, rawBody, 'webhook-secret'),
            },
            body: rawBody,
        });

        const valid = await provider.verifyWebhook({ request, rawBody, url: request.url });
        assert.equal(valid.ok, true);

        const invalid = await provider.verifyWebhook({
            request: new Request(request.url, {
                method: 'POST',
                headers: { ...Object.fromEntries(request.headers), 'x-twilio-signature': 'invalid' },
                body: rawBody,
            }),
            rawBody,
            url: request.url,
        });
        assert.equal(invalid.ok, false);
        assert.equal(invalid.status, 403);
    } finally {
        if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
        else process.env.TWILIO_AUTH_TOKEN = originalToken;
    }
});

test('TwilioWhatsAppProvider rejects a template without a configured Content SID', async () => {
    const provider = new TwilioWhatsAppProvider();
    const result = await provider.send({
        channel: 'whatsapp',
        deliveryId: 'delivery-template-missing',
        recipientPhone: '+972501234567',
        body: 'Fallback text',
        templateKey: 'registration_confirmation',
        providerConfig: { twilio_from_number: 'whatsapp:+14155238886' },
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.errorCode, 'twilio_template_not_configured');
    assert.equal(result.shouldRetry, false);
});

test('TwilioWhatsAppProvider.parseWebhook separates delivery statuses from inbound messages', async () => {
    const provider = new TwilioWhatsAppProvider();
    const request = new Request('https://example.com/api/webhooks/whatsapp/twilio-whatsapp', {
        method: 'POST',
    });

    const statusResult = await provider.parseWebhook({
        request,
        rawBody: 'MessageSid=SM123&MessageStatus=delivered',
        url: request.url,
    });

    const inboundResult = await provider.parseWebhook({
        request,
        rawBody: 'MessageSid=SM456&From=whatsapp%3A%2B972501234567&Body=Hello+there',
        url: request.url,
    });

    assert.equal(statusResult.inboundMessages.length, 0);
    assert.equal(statusResult.statusEvents.length, 1);
    assert.equal(statusResult.statusEvents[0]?.status, 'delivered');

    assert.equal(inboundResult.inboundMessages.length, 1);
    assert.equal(inboundResult.statusEvents.length, 0);
    assert.equal(inboundResult.inboundMessages[0]?.fromPhone, 'whatsapp:+972501234567');
});

test('TwilioWhatsAppProvider.parseWebhook uses Twilio Timestamp for stable status deduplication', async () => {
    const provider = new TwilioWhatsAppProvider();
    const request = new Request('https://example.com/api/webhooks/whatsapp/twilio-whatsapp', { method: 'POST' });

    const result = await provider.parseWebhook({
        request,
        rawBody: 'MessageSid=SM123&MessageStatus=delivered&Timestamp=2026-08-11T10%3A00%3A00Z',
        url: request.url,
    });

    assert.equal(result.statusEvents[0]?.occurredAt, '2026-08-11T10:00:00.000Z');
});

function buildTwilioSignature(url: string, rawBody: string, authToken: string) {
    const params = new URLSearchParams(rawBody);
    const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const data = `${url}${sorted.map(([key, value]) => `${key}${value}`).join('')}`;
    return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}
