import { MockWhatsAppProvider } from '@/lib/notifications/providers/mock-whatsapp';
import type { NotificationProvider } from '@/lib/notifications/types';

const mockProvider = new MockWhatsAppProvider();

export function getNotificationProvider(providerName?: string | null): NotificationProvider {
    switch (providerName) {
        case 'twilio-whatsapp':
        case 'meta-cloud-api':
        case 'mock-whatsapp':
        default:
            return mockProvider;
    }
}
