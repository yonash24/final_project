import { MockWhatsAppProvider } from '@/lib/notifications/providers/mock-whatsapp';
import { TwilioWhatsAppProvider } from '@/lib/notifications/providers/twilio-whatsapp';
import { MetaCloudApiProvider } from '@/lib/notifications/providers/meta-cloud-api';
import type {
    NotificationProvider,
    NotificationProviderName,
} from '@/lib/notifications/types';

const mockProvider = new MockWhatsAppProvider();
const twilioProvider = new TwilioWhatsAppProvider();
const metaCloudApiProvider = new MetaCloudApiProvider();

export function getNotificationProvider(providerName?: NotificationProviderName | null): NotificationProvider {
    switch (providerName) {
        case 'mock-whatsapp':
            return mockProvider;
        case 'twilio-whatsapp':
            return twilioProvider;
        case 'meta-cloud-api':
            return metaCloudApiProvider;
        default:
            // Never send live messages just because a setting is missing.
            return mockProvider;
    }
}

export function getAllNotificationProviders(): NotificationProvider[] {
    return [twilioProvider, metaCloudApiProvider, mockProvider];
}
