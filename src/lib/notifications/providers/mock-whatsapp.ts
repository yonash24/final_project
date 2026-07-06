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

export class MockWhatsAppProvider implements NotificationProvider {
    readonly name = 'mock-whatsapp' as const;

    getHealth(config: NotificationProviderConfig) {
        const status = buildProviderEnvStatus(this.name, config, []);
        status.isConfigured = true;
        return status;
    }

    async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
        console.info('[Notifications] Simulated WhatsApp send', {
            deliveryId: request.deliveryId,
            to: normalizePhoneNumber(request.recipientPhone),
            preview: request.body,
            templateKey: request.templateKey,
        });

        return {
            status: 'simulated',
            providerMessageId: `mock-${request.deliveryId}`,
            deliveredAt: new Date().toISOString(),
            providerResponse: {
                simulated: true,
            },
        };
    }

    async verifyWebhook(): Promise<NotificationWebhookVerificationResult> {
        return { ok: true, status: 200 };
    }

    async parseWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookParseResult> {
        const payload = context.rawBody ? JSON.parse(context.rawBody) as Record<string, unknown> : {};
        return {
            inboundMessages: [{
                provider: this.name,
                providerMessageId: typeof payload.messageId === 'string' ? payload.messageId : `mock-inbound-${Date.now()}`,
                fromPhone: typeof payload.from === 'string' ? payload.from : '+10000000000',
                profileName: typeof payload.profileName === 'string' ? payload.profileName : 'Mock User',
                text: typeof payload.text === 'string' ? payload.text : '',
                receivedAt: typeof payload.receivedAt === 'string' ? payload.receivedAt : new Date().toISOString(),
                rawPayload: payload,
            }],
            statusEvents: [],
        };
    }
}
