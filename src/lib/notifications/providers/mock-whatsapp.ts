import type {
    NotificationProvider,
    NotificationSendRequest,
    NotificationSendResult,
} from '@/lib/notifications/types';

export class MockWhatsAppProvider implements NotificationProvider {
    readonly name = 'mock-whatsapp';

    async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
        console.info('[Notifications] Simulated WhatsApp send', {
            deliveryId: request.deliveryId,
            to: request.recipientPhone,
            preview: request.body,
        });

        return {
            status: 'simulated',
            providerMessageId: `mock-${request.deliveryId}`,
            deliveredAt: new Date().toISOString(),
        };
    }
}
