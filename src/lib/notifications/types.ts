export type NotificationChannel = 'whatsapp';

export type NotificationTemplateKey =
    | 'registration_confirmation'
    | 'class_reminder'
    | 'event_reminder';

export type NotificationDeliveryStatus =
    | 'pending'
    | 'simulated'
    | 'sent'
    | 'failed';

export interface NotificationSettingsRecord {
    id: string;
    channel: NotificationChannel;
    provider: string;
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string | null;
    admin_contact_phone: string | null;
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
    provider: string;
    template_key: NotificationTemplateKey | null;
    recipient_name: string | null;
    recipient_phone: string;
    status: NotificationDeliveryStatus;
    payload: Record<string, unknown>;
    rendered_body: string | null;
    scheduled_for: string;
    processed_at: string | null;
    delivered_at: string | null;
    error_message: string | null;
    created_at: string;
}

export interface NotificationSendRequest {
    channel: NotificationChannel;
    recipientPhone: string;
    body: string;
    deliveryId: string;
}

export interface NotificationSendResult {
    status: Extract<NotificationDeliveryStatus, 'simulated' | 'sent' | 'failed'>;
    providerMessageId?: string;
    deliveredAt?: string;
    errorMessage?: string;
}

export interface NotificationProvider {
    readonly name: string;
    send(request: NotificationSendRequest): Promise<NotificationSendResult>;
}

export interface NotificationSettingsPayload {
    provider: string;
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string;
    admin_contact_phone: string;
    templates: Array<{
        template_key: NotificationTemplateKey;
        is_enabled: boolean;
        body: string;
    }>;
}
