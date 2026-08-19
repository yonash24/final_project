import type { PostgrestError } from '@supabase/supabase-js';

import type { WhatsAppMessageEventRecord } from './types';

export function isDuplicateDatabaseError(error: PostgrestError | null | undefined) {
    return error?.code === '23505';
}

export function mapDeliveryStatus(status: string) {
    switch (status) {
        case 'delivered':
            return 'delivered';
        case 'read':
            return 'read';
        case 'accepted':
        case 'queued':
        case 'sent':
            return 'sent';
        case 'failed':
        case 'undelivered':
            return 'failed';
        default:
            return 'sent';
    }
}

export function mapWhatsAppEventType(status: string): WhatsAppMessageEventRecord['event_type'] {
    switch (status) {
        case 'delivered':
            return 'provider_delivered';
        case 'read':
            return 'provider_read';
        case 'failed':
        case 'undelivered':
            return 'provider_failed';
        default:
            return 'provider_accepted';
    }
}
