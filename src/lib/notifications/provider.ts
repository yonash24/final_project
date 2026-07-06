import { MetaCloudApiProvider } from '@/lib/notifications/providers/meta-cloud-api';
import { MockWhatsAppProvider } from '@/lib/notifications/providers/mock-whatsapp';
import { TwilioWhatsAppProvider } from '@/lib/notifications/providers/twilio-whatsapp';
import type {
    NotificationProvider,
    NotificationProviderName,
} from '@/lib/notifications/types';

const mockProvider = new MockWhatsAppProvider();
const twilioProvider = new TwilioWhatsAppProvider();
const metaProvider = new MetaCloudApiProvider();

export function getNotificationProvider(providerName?: NotificationProviderName | null): NotificationProvider {
    switch (providerName) {
        case 'twilio-whatsapp':
            return twilioProvider;
        case 'meta-cloud-api':
            return metaProvider;
        case 'mock-whatsapp':
        default:
            return mockProvider;
    }
}

export function getAllNotificationProviders(): NotificationProvider[] {
    return [mockProvider, twilioProvider, metaProvider];
}
