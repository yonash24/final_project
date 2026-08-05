import { NextRequest, NextResponse } from 'next/server';

import { getNotificationProvider } from '@/lib/notifications/provider';
import {
    handleIncomingWhatsAppMessage,
    handleWhatsAppStatusEvent,
} from '@/lib/notifications/service';
import type { NotificationProviderName } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

function isSupportedProvider(value: string): value is NotificationProviderName {
    return value === 'mock-whatsapp' || value === 'twilio-whatsapp';
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

        for (const statusEvent of parsed.statusEvents) {
            await handleWhatsAppStatusEvent(statusEvent);
        }

        for (const inboundMessage of parsed.inboundMessages) {
            await handleIncomingWhatsAppMessage(inboundMessage);
        }

        return NextResponse.json({
            ok: true,
            inboundMessages: parsed.inboundMessages.length,
            statusEvents: parsed.statusEvents.length,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook processing failed';
        console.error('[WhatsAppWebhook] POST failed.', {
            provider: providerForLog,
            error,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
