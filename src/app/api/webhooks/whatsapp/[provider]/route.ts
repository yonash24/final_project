import { after, NextRequest, NextResponse } from 'next/server';

import { getNotificationProvider } from '@/lib/notifications/provider';
import {
    handleIncomingWhatsAppMessage,
    handleWhatsAppStatusEvent,
} from '@/lib/notifications/service';
import type { NotificationProviderName } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

function twimlEmptyResponse() {
    return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
}

function acknowledgement(provider: NotificationProviderName) {
    return provider === 'twilio-whatsapp'
        ? twimlEmptyResponse()
        : NextResponse.json({ ok: true }, { status: 200 });
}

function isSupportedProvider(value: string): value is NotificationProviderName {
    return value === 'mock-whatsapp' || value === 'twilio-whatsapp' || value === 'meta-cloud-api';
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
    try {
        const { provider } = await context.params;
        if (!isSupportedProvider(provider)) {
            return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
        }

        const adapter = getNotificationProvider(provider);
        if (!adapter.verifyWebhookChallenge) {
            return new NextResponse('OK', { status: 200 });
        }

        const result = await adapter.verifyWebhookChallenge(request);
        if (!result.ok) {
            return NextResponse.json({ error: result.errorMessage ?? 'Webhook verification failed' }, { status: result.status ?? 403 });
        }

        return new NextResponse(result.responseBody ?? 'OK', { status: result.status ?? 200 });
    } catch (error) {
        console.error('[WhatsAppWebhook] GET failed.', error);
        return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
    let providerForLog = 'unknown';

    try {
        const { provider } = await context.params;
        providerForLog = provider;

        if (!isSupportedProvider(provider)) {
            return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
        }

        const adapter = getNotificationProvider(provider);
        const rawBody = await request.text();
        const verification = await adapter.verifyWebhook({
            request,
            rawBody,
            url: request.url,
        });

        if (!verification.ok) {
            return NextResponse.json({ error: verification.errorMessage ?? 'Webhook verification failed' }, { status: verification.status ?? 403 });
        }

        const parsed = await adapter.parseWebhook({
            request,
            rawBody,
            url: request.url,
        });

        after(async () => {
            try {
                await Promise.all(parsed.statusEvents.map((statusEvent) => handleWhatsAppStatusEvent(statusEvent)));
                await Promise.all(parsed.inboundMessages.map((inboundMessage) => handleIncomingWhatsAppMessage(inboundMessage)));
            } catch (error) {
                console.error('[WhatsAppWebhook] Background processing failed.', {
                    provider: providerForLog,
                    error: error instanceof Error ? error.message : 'unknown_error',
                });
            }
        });

        return acknowledgement(provider);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook processing failed';
        console.error('[WhatsAppWebhook] POST failed.', {
            provider: providerForLog,
            error,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
