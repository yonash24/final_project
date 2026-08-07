import type { NextRequest } from 'next/server';
import type { ChatApiResponse } from '@/lib/ai/chat-types';

export type NotificationChannel = 'whatsapp';

export type NotificationProviderName =
    | 'mock-whatsapp'
    | 'twilio-whatsapp'
    | 'meta-cloud-api';

export type NotificationTemplateKey =
    | 'registration_confirmation'
    | 'class_reminder'
    | 'event_reminder'
    | 'change_notification';

export type NotificationDeliveryStatus =
    | 'pending'
    | 'processing'
    | 'retrying'
    | 'suppressed'
    | 'simulated'
    | 'sent'
    | 'delivered'
    | 'failed';

export type WhatsAppConversationStatus = 'open' | 'opted_out' | 'closed';

export type WhatsAppDirection = 'inbound' | 'outbound';

export type WhatsAppMessageKind = 'text' | 'template' | 'status' | 'system';

export type WhatsAppEventType =
    | 'queued'
    | 'send_attempt'
    | 'provider_accepted'
    | 'provider_delivered'
    | 'provider_read'
    | 'provider_failed'
    | 'received'
    | 'opt_in'
    | 'opt_out';

export type WhatsAppOptInStatus = 'unknown' | 'opted_in' | 'opted_out';

export interface NotificationProviderConfig {
    twilio_from_number?: string;
    meta_phone_number_id?: string;
    meta_business_account_id?: string;
    status_callback_url?: string;
    test_recipient_phone?: string;
}

export interface NotificationSettingsRecord {
    id: string;
    channel: NotificationChannel;
    provider: NotificationProviderName;
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string | null;
    admin_contact_phone: string | null;
    provider_config: NotificationProviderConfig | null;
    updated_at: string;
}

export interface NotificationTemplateRecord {
    id: string;
    template_key: NotificationTemplateKey;
    channel: NotificationChannel;
    label: string;
    description: string | null;
    is_enabled: boolean;
    body: string;
    variables: string[];
    updated_at: string;
}

export interface NotificationDeliveryRecord {
    id: string;
    channel: NotificationChannel;
    provider: NotificationProviderName;
    template_key: NotificationTemplateKey | null;
    recipient_name: string | null;
    recipient_phone: string;
    status: NotificationDeliveryStatus;
    payload: Record<string, unknown>;
    rendered_body: string | null;
    related_conversation_id: string | null;
    scheduled_for: string;
    attempts_count: number;
    last_attempted_at: string | null;
    next_retry_at: string | null;
    processed_at: string | null;
    delivered_at: string | null;
    provider_message_id: string | null;
    error_message: string | null;
    last_error_code: string | null;
    provider_response: Record<string, unknown> | null;
    idempotency_key: string | null;
    created_at: string;
}

export interface WhatsAppConversationRecord {
    id: string;
    member_id: string | null;
    provider: NotificationProviderName;
    contact_phone: string;
    contact_name: string | null;
    opt_in_status: WhatsAppOptInStatus;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
    last_message_at: string | null;
    status: WhatsAppConversationStatus;
    created_at: string;
    updated_at: string;
}

export interface WhatsAppMessageRecord {
    id: string;
    conversation_id: string;
    member_id: string | null;
    provider: NotificationProviderName;
    direction: WhatsAppDirection;
    message_kind: WhatsAppMessageKind;
    body: string | null;
    provider_message_id: string | null;
    in_reply_to_message_id: string | null;
    delivery_id: string | null;
    chat_response: ChatApiResponse | null;
    metadata: Record<string, unknown>;
    sent_at: string | null;
    received_at: string | null;
    created_at: string;
}

export interface WhatsAppMessageEventRecord {
    id: string;
    message_id: string | null;
    delivery_id: string | null;
    provider: NotificationProviderName;
    event_type: WhatsAppEventType;
    event_status: string | null;
    provider_message_id: string | null;
    payload: Record<string, unknown>;
    occurred_at: string;
    created_at: string;
}

export interface NotificationSendRequest {
    channel: NotificationChannel;
    recipientPhone: string;
    body: string;
    deliveryId: string;
    providerConfig: NotificationProviderConfig;
    templateKey?: NotificationTemplateKey | null;
    metadata?: Record<string, unknown>;
}

export interface NotificationSendResult {
    status: Extract<NotificationDeliveryStatus, 'simulated' | 'sent' | 'failed'>;
    providerMessageId?: string;
    deliveredAt?: string;
    errorMessage?: string;
    errorCode?: string;
    shouldRetry?: boolean;
    providerResponse?: Record<string, unknown>;
}

export interface NotificationProviderHealth {
    provider: NotificationProviderName;
    mode: 'mock' | 'live';
    isConfigured: boolean;
    requiredEnvVars: Array<{ name: string; present: boolean; description: string }>;
    warnings: string[];
}

export interface WhatsAppInboundMessage {
    provider: NotificationProviderName;
    providerMessageId: string;
    fromPhone: string;
    profileName?: string | null;
    text: string;
    receivedAt: string;
    rawPayload: Record<string, unknown>;
}

export interface WhatsAppStatusEvent {
    provider: NotificationProviderName;
    providerMessageId: string;
    status: string;
    occurredAt: string;
    rawPayload: Record<string, unknown>;
    errorCode?: string | null;
    errorMessage?: string | null;
}

export interface NotificationWebhookParseResult {
    inboundMessages: WhatsAppInboundMessage[];
    statusEvents: WhatsAppStatusEvent[];
}

export interface NotificationWebhookVerificationResult {
    ok: boolean;
    status?: number;
    responseBody?: string;
    errorMessage?: string;
}

export interface NotificationWebhookContext {
    request: Request;
    rawBody: string;
    url: string;
}

export interface NotificationProvider {
    readonly name: NotificationProviderName;
    getHealth(config: NotificationProviderConfig): NotificationProviderHealth;
    send(request: NotificationSendRequest): Promise<NotificationSendResult>;
    verifyWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookVerificationResult>;
    parseWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookParseResult>;
    verifyWebhookChallenge?(request: NextRequest): Promise<NotificationWebhookVerificationResult>;
}

export interface NotificationSettingsPayload {
    provider: NotificationProviderName;
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string;
    admin_contact_phone: string;
    provider_config: NotificationProviderConfig;
    templates: Array<{
        template_key: NotificationTemplateKey;
        is_enabled: boolean;
        body: string;
    }>;
}

export interface NotificationSettingsResponse {
    settings: NotificationSettingsRecord | null;
    templates: NotificationTemplateRecord[];
    recentDeliveries: NotificationDeliveryRecord[];
    providerStatus: NotificationProviderHealth[];
}

export interface NotificationTestSendPayload {
    recipientPhone: string;
    message?: string;
    templateKey?: NotificationTemplateKey;
}
