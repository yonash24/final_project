import crypto from 'crypto';
import { NextRequest } from 'next/server';

import type {
    NotificationProvider,
    NotificationProviderConfig,
    NotificationSendRequest,
    NotificationSendResult,
    NotificationWebhookContext,
    NotificationWebhookParseResult,
    NotificationWebhookVerificationResult,
} from '@/lib/notifications/types';
import { buildProviderEnvStatus, normalizePhoneNumber } from '@/lib/notifications/utils';

function validateMetaSignature(rawBody: string, request: Request) {
    const appSecret = process.env.META_WHATSAPP_APP_SECRET;
    const signature = request.headers.get('x-hub-signature-256');

    if (!appSecret || !signature?.startsWith('sha256=')) {
        return false;
    }

    const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const actual = signature.slice('sha256='.length);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export class MetaCloudApiProvider implements NotificationProvider {
    readonly name = 'meta-cloud-api' as const;

    getHealth(config: NotificationProviderConfig) {
        const status = buildProviderEnvStatus(this.name, config, [
            ['META_WHATSAPP_ACCESS_TOKEN', 'Meta access token with WhatsApp messaging permissions'],
            ['META_WHATSAPP_VERIFY_TOKEN', 'Webhook verification token for Meta callback setup'],
            ['META_WHATSAPP_APP_SECRET', 'App secret for webhook signature validation'],
        ]);

        if (!config.meta_phone_number_id) {
            status.warnings.push('Provider config is missing the Meta phone number ID.');
        }

        if (!config.meta_business_account_id) {
            status.warnings.push('Provider config is missing the Meta business account ID.');
        }

        status.isConfigured = status.isConfigured
            && Boolean(config.meta_phone_number_id)
            && Boolean(config.meta_business_account_id);

        return status;
    }

    async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
        const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = request.providerConfig.meta_phone_number_id;

        if (!accessToken || !phoneNumberId) {
            return {
                status: 'failed',
                errorCode: 'meta_not_configured',
                errorMessage: 'Meta Cloud API provider is missing required configuration.',
                shouldRetry: false,
            };
        }

        try {
            const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: normalizePhoneNumber(request.recipientPhone).replace(/^\+/, ''),
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: request.body,
                    },
                }),
            });
            const payload = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                const errorInfo = typeof payload.error === 'object' && payload.error
                    ? payload.error as Record<string, unknown>
                    : {};

                return {
                    status: 'failed',
                    errorCode: typeof errorInfo.code === 'number' ? String(errorInfo.code) : 'meta_send_failed',
                    errorMessage: typeof errorInfo.message === 'string' ? errorInfo.message : 'Meta send failed.',
                    shouldRetry: response.status >= 500 || response.status === 429,
                    providerResponse: payload,
                };
            }

            const messages = Array.isArray(payload.messages) ? payload.messages as Array<Record<string, unknown>> : [];
            return {
                status: 'sent',
                providerMessageId: typeof messages[0]?.id === 'string' ? messages[0].id : undefined,
                providerResponse: payload,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Meta error';
            return {
                status: 'failed',
                errorCode: 'meta_network_error',
                errorMessage: message,
                shouldRetry: true,
            };
        }
    }

    async verifyWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookVerificationResult> {
        return {
            ok: validateMetaSignature(context.rawBody, context.request),
            status: 403,
            errorMessage: 'Invalid Meta signature.',
        };
    }

    async verifyWebhookChallenge(request: NextRequest): Promise<NotificationWebhookVerificationResult> {
        const verifyToken = request.nextUrl.searchParams.get('hub.verify_token');
        const challenge = request.nextUrl.searchParams.get('hub.challenge');
        const mode = request.nextUrl.searchParams.get('hub.mode');

        if (mode === 'subscribe' && verifyToken && verifyToken === process.env.META_WHATSAPP_VERIFY_TOKEN) {
            return {
                ok: true,
                status: 200,
                responseBody: challenge ?? '',
            };
        }

        return {
            ok: false,
            status: 403,
            errorMessage: 'Invalid Meta webhook verification token.',
        };
    }

    async parseWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookParseResult> {
        const payload = JSON.parse(context.rawBody) as {
            entry?: Array<{
                changes?: Array<{
                    value?: {
                        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
                        messages?: Array<{ from?: string; id?: string; text?: { body?: string }; timestamp?: string }>;
                        statuses?: Array<{ id?: string; status?: string; timestamp?: string; errors?: Array<{ code?: number; title?: string }> }>;
                    };
                }>;
            }>;
        };

        const inboundMessages = [];
        const statusEvents = [];

        for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
                const value = change.value;
                const contacts = value?.contacts ?? [];
                const contact = contacts[0];

                for (const message of value?.messages ?? []) {
                    inboundMessages.push({
                        provider: this.name,
                        providerMessageId: message.id ?? crypto.randomUUID(),
                        fromPhone: message.from ? `+${message.from}` : '',
                        profileName: contact?.profile?.name ?? null,
                        text: message.text?.body ?? '',
                        receivedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
                        rawPayload: payload as unknown as Record<string, unknown>,
                    });
                }

                for (const status of value?.statuses ?? []) {
                    const firstError = status.errors?.[0];
                    statusEvents.push({
                        provider: this.name,
                        providerMessageId: status.id ?? crypto.randomUUID(),
                        status: status.status ?? 'unknown',
                        occurredAt: status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString(),
                        rawPayload: payload as unknown as Record<string, unknown>,
                        errorCode: firstError?.code != null ? String(firstError.code) : null,
                        errorMessage: firstError?.title ?? null,
                    });
                }
            }
        }

        return { inboundMessages, statusEvents };
    }
}
