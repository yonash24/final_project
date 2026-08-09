import { z } from 'zod';

import { getChatResponse } from '@/lib/ai/chat-service';
import type { ChatMessage } from '@/lib/ai/intent-classifier';
import { getAllNotificationProviders, getNotificationProvider } from '@/lib/notifications/provider';
import { supabaseServer } from '@/lib/supabase/server';
import type {
    NotificationDeliveryRecord,
    NotificationProviderConfig,
    NotificationSettingsPayload,
    NotificationSettingsRecord,
    NotificationSettingsResponse,
    NotificationTemplateKey,
    NotificationTemplateRecord,
    NotificationTestSendPayload,
    WhatsAppConversationRecord,
    WhatsAppInboundMessage,
    WhatsAppMessageEventRecord,
    WhatsAppMessageRecord,
    WhatsAppOptInStatus,
    WhatsAppStatusEvent,
} from '@/lib/notifications/types';
import {
    detectOptCommand,
    getRetryDelayMs,
    getTestMessageForTemplate,
    normalizePhoneNumber,
    renderTemplate,
    shouldSuppressOutbound,
} from '@/lib/notifications/utils';
import {
    isDuplicateDatabaseError,
    mapDeliveryStatus,
    mapWhatsAppEventType,
} from '@/lib/notifications/service-helpers';

const notificationSettingsSchema = z.object({
    provider: z.enum(['mock-whatsapp', 'twilio-whatsapp', 'meta-cloud-api']),
    is_enabled: z.coerce.boolean(),
    send_registration_confirmations: z.coerce.boolean(),
    send_class_reminders: z.coerce.boolean(),
    send_event_reminders: z.coerce.boolean(),
    reminder_lead_hours: z.coerce.number().int().min(1).max(168),
    admin_contact_name: z.string().default(''),
    admin_contact_phone: z.string().default(''),
    provider_config: z.object({
        twilio_from_number: z.string().default(''),
        twilio_content_sids: z.object({
            registration_confirmation: z.string().default(''),
            class_reminder: z.string().default(''),
            event_reminder: z.string().default(''),
            change_notification: z.string().default(''),
        }).default(() => ({
            registration_confirmation: '',
            class_reminder: '',
            event_reminder: '',
            change_notification: '',
        })),
        meta_phone_number_id: z.string().default(''),
        meta_business_account_id: z.string().default(''),
        status_callback_url: z.string().default(''),
        test_recipient_phone: z.string().default(''),
    }).default(() => ({
        twilio_from_number: '',
        twilio_content_sids: {
            registration_confirmation: '',
            class_reminder: '',
            event_reminder: '',
            change_notification: '',
        },
        meta_phone_number_id: '',
        meta_business_account_id: '',
        status_callback_url: '',
        test_recipient_phone: '',
    })),
    templates: z.array(
        z.object({
            template_key: z.enum([
                'registration_confirmation',
                'class_reminder',
                'event_reminder',
                'change_notification',
            ]),
            is_enabled: z.coerce.boolean(),
            body: z.string().min(10),
        }),
    ),
});

const testSendSchema = z.object({
    recipientPhone: z.string().min(8),
    message: z.string().max(500).optional(),
    templateKey: z.enum([
        'registration_confirmation',
        'class_reminder',
        'event_reminder',
        'change_notification',
    ]).optional(),
});

function sanitizeProviderConfig(input?: NotificationProviderConfig | null): NotificationProviderConfig {
    return {
        twilio_from_number: input?.twilio_from_number?.trim() || undefined,
        twilio_content_sids: Object.fromEntries(
            Object.entries(input?.twilio_content_sids ?? {})
                .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
                .filter(([, value]) => Boolean(value)),
        ),
        meta_phone_number_id: input?.meta_phone_number_id?.trim() || undefined,
        meta_business_account_id: input?.meta_business_account_id?.trim() || undefined,
        status_callback_url: input?.status_callback_url?.trim() || undefined,
        test_recipient_phone: input?.test_recipient_phone?.trim() || undefined,
    };
}

async function loadNotificationSettingsSnapshot() {
    const [{ data: settings, error: settingsError }, { data: templates, error: templatesError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
        supabaseServer
            .from('notification_settings')
            .select('*')
            .eq('channel', 'whatsapp')
            .maybeSingle(),
        supabaseServer
            .from('notification_templates')
            .select('*')
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: true }),
        supabaseServer
            .from('notification_deliveries')
            .select('id, channel, provider, template_key, recipient_name, recipient_phone, status, payload, rendered_body, related_conversation_id, scheduled_for, attempts_count, last_attempted_at, next_retry_at, processed_at, delivered_at, provider_message_id, error_message, last_error_code, provider_response, idempotency_key, created_at')
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: false })
            .limit(12),
    ]);

    if (settingsError) throw settingsError;
    if (templatesError) throw templatesError;
    if (deliveriesError) throw deliveriesError;

    const typedSettings = settings as NotificationSettingsRecord | null;
    const providerConfig = sanitizeProviderConfig(typedSettings?.provider_config);

    return {
        settings: typedSettings ? { ...typedSettings, provider_config: providerConfig } : null,
        templates: (templates ?? []).map((item) => ({
            ...item,
            variables: Array.isArray(item.variables) ? item.variables : [],
        })) as NotificationTemplateRecord[],
        recentDeliveries: (deliveries ?? []) as NotificationDeliveryRecord[],
    };
}

async function resolveSettingsAndTemplate(templateKey?: NotificationTemplateKey | null) {
    const snapshot = await loadNotificationSettingsSnapshot();
    const template = templateKey
        ? snapshot.templates.find((item) => item.template_key === templateKey)
        : null;

    return {
        ...snapshot,
        template,
        providerConfig: sanitizeProviderConfig(snapshot.settings?.provider_config),
    };
}

async function findMemberByPhone(phone: string) {
    const { data, error } = await supabaseServer
        .from('members')
        .select('id, full_name, phone, whatsapp_opt_in_status')
        .eq('phone', phone)
        .maybeSingle();

    if (error) throw error;
    return data as { id: string; full_name: string; phone: string; whatsapp_opt_in_status: WhatsAppOptInStatus | null } | null;
}

async function upsertMemberByPhone(phone: string, fullName?: string | null) {
    const normalizedPhone = normalizePhoneNumber(phone);
    const existing = await findMemberByPhone(normalizedPhone);
    if (existing) {
        if (fullName && fullName !== existing.full_name) {
            await supabaseServer
                .from('members')
                .update({ full_name: fullName, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        }

        return {
            id: existing.id,
            full_name: fullName || existing.full_name,
            phone: normalizedPhone,
            whatsapp_opt_in_status: existing.whatsapp_opt_in_status ?? 'unknown',
        };
    }

    const { data, error } = await supabaseServer
        .from('members')
        .upsert({
            full_name: fullName || `WhatsApp ${normalizedPhone.slice(-4)}`,
            phone: normalizedPhone,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'phone' })
        .select('id, full_name, phone, whatsapp_opt_in_status')
        .single();

    if (error) throw error;
    return data as { id: string; full_name: string; phone: string; whatsapp_opt_in_status: WhatsAppOptInStatus | null };
}

async function upsertConversation(args: {
    memberId: string | null;
    provider: NotificationSettingsRecord['provider'];
    phone: string;
    contactName?: string | null;
    optInStatus?: WhatsAppOptInStatus;
}) {
    const normalizedPhone = normalizePhoneNumber(args.phone);
    const { data: existing, error: existingError } = await supabaseServer
        .from('whatsapp_conversations')
        .select('*')
        .eq('provider', args.provider)
        .eq('contact_phone', normalizedPhone)
        .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (args.contactName) updates.contact_name = args.contactName;
        if (args.memberId) updates.member_id = args.memberId;
        if (args.optInStatus) {
            updates.opt_in_status = args.optInStatus;
            updates.status = args.optInStatus === 'opted_out' ? 'opted_out' : 'open';
        }

        const { data, error } = await supabaseServer
            .from('whatsapp_conversations')
            .update(updates)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw error;
        return data as WhatsAppConversationRecord;
    }

    const { data, error } = await supabaseServer
        .from('whatsapp_conversations')
        .insert([{
            member_id: args.memberId,
            provider: args.provider,
            contact_phone: normalizedPhone,
            contact_name: args.contactName ?? null,
            opt_in_status: args.optInStatus ?? 'unknown',
            status: args.optInStatus === 'opted_out' ? 'opted_out' : 'open',
        }])
        .select('*')
        .single();

    if (error) throw error;
    return data as WhatsAppConversationRecord;
}

async function updateMemberOptStatus(phone: string, status: WhatsAppOptInStatus, source: string, fullName?: string | null) {
    const member = await upsertMemberByPhone(phone, fullName);
    const updates: Record<string, unknown> = {
        whatsapp_opt_in_status: status,
        whatsapp_opt_in_source: source,
        updated_at: new Date().toISOString(),
    };

    if (status === 'opted_in') {
        updates.whatsapp_opted_in_at = new Date().toISOString();
    }

    if (status === 'opted_out') {
        updates.whatsapp_opted_out_at = new Date().toISOString();
    }

    const { error } = await supabaseServer
        .from('members')
        .update(updates)
        .eq('id', member.id);

    if (error) throw error;

    return {
        ...member,
        whatsapp_opt_in_status: status,
    };
}

async function appendWhatsAppMessage(args: {
    conversationId: string;
    memberId?: string | null;
    provider: NotificationSettingsRecord['provider'];
    direction: 'inbound' | 'outbound';
    body?: string | null;
    providerMessageId?: string | null;
    deliveryId?: string | null;
    messageKind?: 'text' | 'template' | 'system';
    inReplyToMessageId?: string | null;
    chatResponse?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
    receivedAt?: string | null;
    sentAt?: string | null;
}) {
    if (args.providerMessageId) {
        const existing = await findWhatsAppMessageByProviderMessageId(args.provider, args.providerMessageId);
        if (existing) {
            return existing;
        }
    }

    const { data, error } = await supabaseServer
        .from('whatsapp_messages')
        .insert([{
            conversation_id: args.conversationId,
            member_id: args.memberId ?? null,
            provider: args.provider,
            direction: args.direction,
            message_kind: args.messageKind ?? 'text',
            body: args.body ?? null,
            provider_message_id: args.providerMessageId ?? null,
            in_reply_to_message_id: args.inReplyToMessageId ?? null,
            delivery_id: args.deliveryId ?? null,
            chat_response: args.chatResponse ?? null,
            metadata: args.metadata ?? {},
            sent_at: args.sentAt ?? null,
            received_at: args.receivedAt ?? null,
        }])
        .select('*')
        .single();

    if (error) {
        if (args.providerMessageId && isDuplicateDatabaseError(error)) {
            const existing = await findWhatsAppMessageByProviderMessageId(args.provider, args.providerMessageId);
            if (existing) {
                return existing;
            }
        }

        throw error;
    }
    return data as WhatsAppMessageRecord;
}

async function appendWhatsAppEvent(args: {
    messageId?: string | null;
    deliveryId?: string | null;
    provider: NotificationSettingsRecord['provider'];
    eventType: WhatsAppMessageEventRecord['event_type'];
    eventStatus?: string | null;
    providerMessageId?: string | null;
    payload?: Record<string, unknown>;
    occurredAt?: string;
}) {
    const occurredAt = args.occurredAt ?? new Date().toISOString();
    const existing = await findExistingWhatsAppEvent({
        provider: args.provider,
        providerMessageId: args.providerMessageId ?? null,
        eventType: args.eventType,
        eventStatus: args.eventStatus ?? null,
        occurredAt,
    });

    if (existing) {
        return existing;
    }

    const { data, error } = await supabaseServer
        .from('whatsapp_message_events')
        .insert([{
            message_id: args.messageId ?? null,
            delivery_id: args.deliveryId ?? null,
            provider: args.provider,
            event_type: args.eventType,
            event_status: args.eventStatus ?? null,
            provider_message_id: args.providerMessageId ?? null,
            payload: args.payload ?? {},
            occurred_at: occurredAt,
        }])
        .select('*')
        .single();

    if (error) throw error;
    return data as WhatsAppMessageEventRecord;
}

async function syncConversationActivity(conversationId: string, updates: {
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
    lastMessageAt?: string | null;
    optInStatus?: WhatsAppOptInStatus;
}) {
    const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (updates.lastInboundAt) payload.last_inbound_at = updates.lastInboundAt;
    if (updates.lastOutboundAt) payload.last_outbound_at = updates.lastOutboundAt;
    if (updates.lastMessageAt) payload.last_message_at = updates.lastMessageAt;
    if (updates.optInStatus) {
        payload.opt_in_status = updates.optInStatus;
        payload.status = updates.optInStatus === 'opted_out' ? 'opted_out' : 'open';
    }

    const { error } = await supabaseServer
        .from('whatsapp_conversations')
        .update(payload)
        .eq('id', conversationId);

    if (error) throw error;
}

async function getConversationHistory(conversationId: string) {
    const { data, error } = await supabaseServer
        .from('whatsapp_messages')
        .select('id, direction, body')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);

    if (error) throw error;

    return ((data ?? []) as Array<{ id: string; direction: 'inbound' | 'outbound'; body: string | null }>)
        .reverse()
        .filter((item) => Boolean(item.body))
        .map((item) => ({
            role: item.direction === 'inbound' ? 'user' : 'assistant',
            content: item.body ?? '',
        })) as ChatMessage[];
}

async function getConversationHistoryExcludingMessage(conversationId: string, excludedMessageId?: string | null) {
    const history = await getConversationHistory(conversationId);

    if (!excludedMessageId) {
        return history;
    }

    const { data, error } = await supabaseServer
        .from('whatsapp_messages')
        .select('id, direction, body')
        .eq('conversation_id', conversationId)
        .neq('id', excludedMessageId)
        .order('created_at', { ascending: false })
        .limit(6);

    if (error) throw error;

    return ((data ?? []) as Array<{ id: string; direction: 'inbound' | 'outbound'; body: string | null }>)
        .reverse()
        .filter((item) => Boolean(item.body))
        .map((item) => ({
            role: item.direction === 'inbound' ? 'user' : 'assistant',
            content: item.body ?? '',
        })) as ChatMessage[];
}

async function updateDeliveryState(deliveryId: string, updates: Record<string, unknown>) {
    const { error } = await supabaseServer
        .from('notification_deliveries')
        .update(updates)
        .eq('id', deliveryId);

    if (error) throw error;
}

async function getConversationById(conversationId: string) {
    const { data, error } = await supabaseServer
        .from('whatsapp_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

    if (error) throw error;
    return data as WhatsAppConversationRecord | null;
}

async function createDelivery(args: {
    provider: NotificationSettingsRecord['provider'];
    templateKey?: NotificationTemplateKey | null;
    recipientName?: string | null;
    recipientPhone: string;
    payload: Record<string, unknown>;
    relatedRegistrationId?: string | null;
    relatedActivityId?: string | null;
    relatedEventId?: string | null;
    relatedConversationId?: string | null;
    scheduledFor?: string;
    renderedBody: string;
    idempotencyKey?: string | null;
}) {
    if (args.idempotencyKey) {
        const existing = await findDeliveryByIdempotencyKey(args.idempotencyKey);
        if (existing) {
            return existing;
        }
    }

    const { data, error } = await supabaseServer
        .from('notification_deliveries')
        .insert([{
            channel: 'whatsapp',
            provider: args.provider,
            template_key: args.templateKey ?? null,
            recipient_name: args.recipientName ?? null,
            recipient_phone: normalizePhoneNumber(args.recipientPhone),
            status: 'pending',
            payload: args.payload,
            rendered_body: args.renderedBody,
            related_registration_id: args.relatedRegistrationId ?? null,
            related_activity_id: args.relatedActivityId ?? null,
            related_event_id: args.relatedEventId ?? null,
            related_conversation_id: args.relatedConversationId ?? null,
            scheduled_for: args.scheduledFor ?? new Date().toISOString(),
            idempotency_key: args.idempotencyKey ?? null,
        }])
        .select('*')
        .single();

    if (error) {
        if (args.idempotencyKey && isDuplicateDatabaseError(error)) {
            const existing = await findDeliveryByIdempotencyKey(args.idempotencyKey);
            if (existing) {
                return existing;
            }
        }

        throw error;
    }

    const delivery = data as NotificationDeliveryRecord;
    await appendWhatsAppEvent({
        deliveryId: delivery.id,
        provider: args.provider,
        eventType: 'queued',
        eventStatus: delivery.status,
        payload: {
            templateKey: args.templateKey ?? null,
            scheduledFor: delivery.scheduled_for,
        },
    });

    return delivery;
}

async function findDeliveryByIdempotencyKey(idempotencyKey: string) {
    const { data, error } = await supabaseServer
        .from('notification_deliveries')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (error) throw error;
    return data as NotificationDeliveryRecord | null;
}

async function findWhatsAppMessageByProviderMessageId(
    provider: NotificationSettingsRecord['provider'],
    providerMessageId: string,
) {
    const { data, error } = await supabaseServer
        .from('whatsapp_messages')
        .select('*')
        .eq('provider', provider)
        .eq('provider_message_id', providerMessageId)
        .maybeSingle();

    if (error) throw error;
    return data as WhatsAppMessageRecord | null;
}

async function findExistingWhatsAppEvent(args: {
    provider: NotificationSettingsRecord['provider'];
    providerMessageId?: string | null;
    eventType: WhatsAppMessageEventRecord['event_type'];
    eventStatus?: string | null;
    occurredAt: string;
}) {
    let query = supabaseServer
        .from('whatsapp_message_events')
        .select('*')
        .eq('provider', args.provider)
        .eq('event_type', args.eventType)
        .eq('occurred_at', args.occurredAt);

    query = args.eventStatus == null
        ? query.is('event_status', null)
        : query.eq('event_status', args.eventStatus);

    query = args.providerMessageId == null
        ? query.is('provider_message_id', null)
        : query.eq('provider_message_id', args.providerMessageId);

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data as WhatsAppMessageEventRecord | null;
}

async function findReplyForInboundMessage(inboundMessageId: string) {
    const { data, error } = await supabaseServer
        .from('whatsapp_messages')
        .select('*')
        .eq('in_reply_to_message_id', inboundMessageId)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data as WhatsAppMessageRecord | null;
}

async function buildDeliveryForTemplate(args: {
    templateKey: NotificationTemplateKey;
    recipientName?: string | null;
    recipientPhone: string;
    payload: Record<string, unknown>;
    relatedRegistrationId?: string | null;
    relatedActivityId?: string | null;
    relatedEventId?: string | null;
    scheduledFor?: string;
}) {
    const config = await resolveSettingsAndTemplate(args.templateKey);
    const settings = config.settings;
    const template = config.template;

    if (!settings || !settings.is_enabled || !template || !template.is_enabled) {
        return null;
    }

    const renderedBody = renderTemplate(template.body, args.payload);
    return createDelivery({
        provider: settings.provider,
        templateKey: args.templateKey,
        recipientName: args.recipientName,
        recipientPhone: args.recipientPhone,
        payload: args.payload,
        relatedRegistrationId: args.relatedRegistrationId,
        relatedActivityId: args.relatedActivityId,
        relatedEventId: args.relatedEventId,
        scheduledFor: args.scheduledFor,
        renderedBody,
        idempotencyKey: `${args.templateKey}:${normalizePhoneNumber(args.recipientPhone)}:${args.relatedRegistrationId ?? args.relatedActivityId ?? args.relatedEventId ?? renderedBody}`,
    });
}

async function claimDelivery(delivery: NotificationDeliveryRecord) {
    const claimedAt = new Date().toISOString();
    const nextAttempt = delivery.attempts_count + 1;
    const { data, error } = await supabaseServer
        .from('notification_deliveries')
        .update({
            status: 'processing',
            attempts_count: nextAttempt,
            last_attempted_at: claimedAt,
            error_message: null,
            last_error_code: null,
        })
        .eq('id', delivery.id)
        .in('status', ['pending', 'retrying'])
        .select('*')
        .maybeSingle();

    if (error) throw error;
    return data as NotificationDeliveryRecord | null;
}

async function dispatchDelivery(delivery: NotificationDeliveryRecord, options?: {
    conversationId?: string | null;
    memberId?: string | null;
    chatResponse?: Record<string, unknown> | null;
    inReplyToMessageId?: string | null;
    metadata?: Record<string, unknown>;
    bypassOptOut?: boolean;
}) {
    const claimed = await claimDelivery(delivery);
    if (!claimed) {
        return null;
    }

    const snapshot = await loadNotificationSettingsSnapshot();
    if (!snapshot.settings) {
        await updateDeliveryState(delivery.id, {
            status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: 'Notification settings are missing.',
            last_error_code: 'settings_missing',
        });
        return null;
    }

    const member = await findMemberByPhone(claimed.recipient_phone);
    const optInStatus = member?.whatsapp_opt_in_status ?? 'unknown';
    if (!options?.bypassOptOut && shouldSuppressOutbound(optInStatus)) {
        await updateDeliveryState(claimed.id, {
            status: 'suppressed',
            processed_at: new Date().toISOString(),
            error_message: 'Recipient opted out from WhatsApp notifications.',
            last_error_code: 'opted_out',
        });
        await appendWhatsAppEvent({
            deliveryId: claimed.id,
            provider: claimed.provider,
            eventType: 'opt_out',
            eventStatus: 'suppressed',
            payload: { recipientPhone: claimed.recipient_phone },
        });
        return null;
    }

    const provider = getNotificationProvider(claimed.provider);
    await appendWhatsAppEvent({
        deliveryId: claimed.id,
        provider: claimed.provider,
        eventType: 'send_attempt',
        eventStatus: 'processing',
        payload: { attempt: claimed.attempts_count },
    });

    const result = await provider.send({
        channel: 'whatsapp',
        deliveryId: claimed.id,
        recipientPhone: claimed.recipient_phone,
        body: claimed.rendered_body ?? '',
        templateKey: claimed.template_key,
        providerConfig: sanitizeProviderConfig(snapshot.settings.provider_config),
        payload: claimed.payload,
        templateVariables: claimed.template_key
            ? snapshot.templates.find((template) => template.template_key === claimed.template_key)?.variables
            : undefined,
        metadata: options?.metadata,
    });

    if (result.status === 'failed') {
        const shouldRetry = Boolean(result.shouldRetry) && claimed.attempts_count < 5;
        await updateDeliveryState(claimed.id, {
            status: shouldRetry ? 'retrying' : 'failed',
            processed_at: new Date().toISOString(),
            provider_message_id: result.providerMessageId ?? null,
            error_message: result.errorMessage ?? null,
            last_error_code: result.errorCode ?? null,
            provider_response: result.providerResponse ?? null,
            next_retry_at: shouldRetry
                ? new Date(Date.now() + getRetryDelayMs(claimed.attempts_count)).toISOString()
                : null,
        });

        await appendWhatsAppEvent({
            deliveryId: claimed.id,
            provider: claimed.provider,
            eventType: 'provider_failed',
            eventStatus: shouldRetry ? 'retrying' : 'failed',
            providerMessageId: result.providerMessageId,
            payload: result.providerResponse ?? {},
        });

        return null;
    }

    await updateDeliveryState(claimed.id, {
        status: result.status,
        provider_message_id: result.providerMessageId ?? null,
        processed_at: new Date().toISOString(),
        delivered_at: result.deliveredAt ?? null,
        provider_response: result.providerResponse ?? null,
        error_message: null,
        last_error_code: null,
        next_retry_at: null,
    });

    const conversationId = options?.conversationId || claimed.related_conversation_id;
    const conversation = conversationId ? await getConversationById(conversationId) : null;
    const outboundMessage = conversation
        ? await appendWhatsAppMessage({
            conversationId: conversation.id,
            memberId: options?.memberId ?? conversation.member_id,
            provider: claimed.provider,
            direction: 'outbound',
            body: claimed.rendered_body,
            providerMessageId: result.providerMessageId ?? null,
            deliveryId: claimed.id,
            inReplyToMessageId: options?.inReplyToMessageId ?? null,
            chatResponse: options?.chatResponse ?? null,
            metadata: options?.metadata ?? {},
            messageKind: claimed.template_key ? 'template' : 'text',
            sentAt: result.deliveredAt ?? new Date().toISOString(),
        })
        : null;

    if (conversation) {
        await syncConversationActivity(conversation.id, {
            lastOutboundAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString(),
        });
    }

    await appendWhatsAppEvent({
        messageId: outboundMessage?.id ?? null,
        deliveryId: claimed.id,
        provider: claimed.provider,
        eventType: result.status === 'simulated' ? 'provider_delivered' : 'provider_accepted',
        eventStatus: result.status,
        providerMessageId: result.providerMessageId,
        payload: result.providerResponse ?? {},
        occurredAt: result.deliveredAt ?? new Date().toISOString(),
    });

    return outboundMessage;
}

async function sendConversationReply(args: {
    conversation: WhatsAppConversationRecord;
    memberId: string | null;
    recipientName?: string | null;
    recipientPhone: string;
    body: string;
    payload?: Record<string, unknown>;
    chatResponse?: Record<string, unknown> | null;
    inReplyToMessageId?: string | null;
}) {
    const delivery = await createDelivery({
        provider: args.conversation.provider,
        recipientName: args.recipientName,
        recipientPhone: args.recipientPhone,
        payload: args.payload ?? { source: 'whatsapp_chat' },
        renderedBody: args.body,
        relatedConversationId: args.conversation.id,
        idempotencyKey: null,
    });

    return dispatchDelivery(delivery, {
        conversationId: args.conversation.id,
        memberId: args.memberId,
        chatResponse: args.chatResponse,
        inReplyToMessageId: args.inReplyToMessageId,
        metadata: {
            source: 'whatsapp_chat',
        },
        bypassOptOut: true,
    });
}

export async function getNotificationSettings(): Promise<NotificationSettingsResponse> {
    const snapshot = await loadNotificationSettingsSnapshot();
    const providerConfig = sanitizeProviderConfig(snapshot.settings?.provider_config);

    return {
        ...snapshot,
        providerStatus: getAllNotificationProviders().map((provider) => provider.getHealth(providerConfig)),
    };
}

export async function updateNotificationSettings(
    input: NotificationSettingsPayload,
) {
    const parsed = notificationSettingsSchema.parse(input);
    const providerConfig = sanitizeProviderConfig(parsed.provider_config);

    const { error: settingsError } = await supabaseServer
        .from('notification_settings')
        .upsert({
            channel: 'whatsapp',
            provider: parsed.provider,
            is_enabled: parsed.is_enabled,
            send_registration_confirmations: parsed.send_registration_confirmations,
            send_class_reminders: parsed.send_class_reminders,
            send_event_reminders: parsed.send_event_reminders,
            reminder_lead_hours: parsed.reminder_lead_hours,
            admin_contact_name: parsed.admin_contact_name || null,
            admin_contact_phone: parsed.admin_contact_phone || null,
            provider_config: providerConfig,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'channel' });

    if (settingsError) throw settingsError;

    for (const template of parsed.templates) {
        const { error } = await supabaseServer
            .from('notification_templates')
            .update({
                body: template.body,
                is_enabled: template.is_enabled,
                updated_at: new Date().toISOString(),
            })
            .eq('template_key', template.template_key);

        if (error) throw error;
    }

    return getNotificationSettings();
}

export async function ensureWhatsAppOptInFromRegistration(phone: string, fullName: string) {
    const existing = await findMemberByPhone(normalizePhoneNumber(phone));
    if (existing?.whatsapp_opt_in_status === 'opted_out') {
        return existing;
    }

    return updateMemberOptStatus(phone, 'opted_in', 'registration', fullName);
}

export async function queueRegistrationConfirmation(input: {
    registrationId: string;
    activityId: string;
    activityTitle: string;
    recipientName: string;
    recipientPhone: string;
    scheduleText?: string | null;
    locationText?: string | null;
}) {
    const config = await loadNotificationSettingsSnapshot();
    if (!config.settings?.send_registration_confirmations) {
        return;
    }

    const delivery = await buildDeliveryForTemplate({
        templateKey: 'registration_confirmation',
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        relatedRegistrationId: input.registrationId,
        relatedActivityId: input.activityId,
        payload: {
            name: input.recipientName,
            activity_title: input.activityTitle,
            schedule_text: input.scheduleText ?? '',
            location_text: input.locationText ?? '',
        },
    });

    if (delivery) {
        await dispatchDelivery(delivery);
    }
}

export async function scheduleClassReminder(input: {
    registrationId: string;
    activityId: string;
    activityTitle: string;
    recipientName: string;
    recipientPhone: string;
    startAt: string | null;
    locationText?: string | null;
}) {
    const config = await loadNotificationSettingsSnapshot();
    const settings = config.settings;

    if (!settings?.send_class_reminders || !input.startAt) {
        return;
    }

    const startAt = new Date(input.startAt);
    if (Number.isNaN(startAt.valueOf())) {
        return;
    }

    const scheduledFor = new Date(startAt.getTime() - settings.reminder_lead_hours * 60 * 60 * 1000).toISOString();

    await buildDeliveryForTemplate({
        templateKey: 'class_reminder',
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        relatedRegistrationId: input.registrationId,
        relatedActivityId: input.activityId,
        scheduledFor,
        payload: {
            name: input.recipientName,
            activity_title: input.activityTitle,
            start_at: startAt.toLocaleString('he-IL'),
            location_text: input.locationText ?? '',
        },
    });

    await supabaseServer
        .from('registrations')
        .update({ reminder_scheduled_at: scheduledFor })
        .eq('id', input.registrationId);
}

export async function queueEventReminder(input: {
    eventId: string;
    recipientName: string;
    recipientPhone: string;
    eventTitle: string;
    startAt: string;
    locationText?: string | null;
}) {
    const config = await loadNotificationSettingsSnapshot();
    const settings = config.settings;

    if (!settings?.send_event_reminders) {
        return;
    }

    const eventStartAt = new Date(input.startAt);
    const scheduledFor = new Date(eventStartAt.getTime() - settings.reminder_lead_hours * 60 * 60 * 1000).toISOString();

    await buildDeliveryForTemplate({
        templateKey: 'event_reminder',
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        relatedEventId: input.eventId,
        scheduledFor,
        payload: {
            name: input.recipientName,
            event_title: input.eventTitle,
            start_at: eventStartAt.toLocaleString('he-IL'),
            location_text: input.locationText ?? '',
        },
    });
}

export async function queueChangeNotification(input: {
    recipientName: string;
    recipientPhone: string;
    subject: string;
    changeSummary: string;
    relatedActivityId?: string | null;
    relatedEventId?: string | null;
}) {
    const config = await loadNotificationSettingsSnapshot();
    if (!config.settings?.is_enabled) {
        return;
    }

    const delivery = await buildDeliveryForTemplate({
        templateKey: 'change_notification',
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        relatedActivityId: input.relatedActivityId,
        relatedEventId: input.relatedEventId,
        payload: {
            name: input.recipientName,
            subject: input.subject,
            change_summary: input.changeSummary,
            contact_name: config.settings.admin_contact_name ?? 'צוות המתנ"ס',
            contact_phone: config.settings.admin_contact_phone ?? '',
        },
    });

    if (delivery) {
        await dispatchDelivery(delivery);
    }
}

export async function processDueDeliveries(limit = 20) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseServer
        .from('notification_deliveries')
        .select('*')
        .in('status', ['pending', 'retrying'])
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(limit * 2);

    if (error) throw error;

    const deliveries = ((data ?? []) as NotificationDeliveryRecord[])
        .filter((delivery) => !delivery.next_retry_at || delivery.next_retry_at <= now)
        .slice(0, limit);
    let processed = 0;

    for (const delivery of deliveries) {
        await dispatchDelivery(delivery);
        processed += 1;
    }

    return {
        processed,
        scanned: deliveries.length,
    };
}

export async function sendTestNotification(input: NotificationTestSendPayload) {
    const parsed = testSendSchema.parse(input);
    const snapshot = await resolveSettingsAndTemplate(parsed.templateKey ?? 'registration_confirmation');

    if (!snapshot.settings) {
        throw new Error('Notification settings are missing.');
    }

    const templateKey = parsed.templateKey ?? 'registration_confirmation';
    const renderedBody = parsed.message?.trim()
        || renderTemplate(snapshot.template?.body ?? '', getTestMessageForTemplate(templateKey));

    const delivery = await createDelivery({
        provider: snapshot.settings.provider,
        templateKey,
        recipientName: 'Test Recipient',
        recipientPhone: parsed.recipientPhone,
        payload: {
            test: true,
            templateKey,
        },
        renderedBody,
    });

    await dispatchDelivery(delivery);
    return getNotificationSettings();
}

function buildCommandReply(command: 'opt_in' | 'opt_out' | 'help') {
    switch (command) {
        case 'opt_out':
            return 'הסרנו אותך מהודעות WhatsApp של המתנ"ס. כדי לחזור לקבל הודעות אפשר להשיב START בכל שלב.';
        case 'opt_in':
            return 'מעולה, חיברנו אותך מחדש להודעות WhatsApp של המתנ"ס. אפשר לשאול עכשיו על חוגים ואירועים.';
        case 'help':
            return 'אפשר לשאול אותי על חוגים, אירועים ופרטי פעילויות. כדי להפסיק הודעות כתוב STOP, וכדי לחדש כתוב START.';
    }
}

export async function handleIncomingWhatsAppMessage(message: WhatsAppInboundMessage) {
    const normalizedPhone = normalizePhoneNumber(message.fromPhone);
    const member = await upsertMemberByPhone(normalizedPhone, message.profileName);
    const command = detectOptCommand(message.text);
    const nextOptStatus = command === 'opt_out'
        ? 'opted_out'
        : command === 'opt_in'
            ? 'opted_in'
            : member.whatsapp_opt_in_status ?? 'unknown';

    if (command === 'opt_in' || command === 'opt_out') {
        await updateMemberOptStatus(normalizedPhone, nextOptStatus, 'whatsapp_inbound', message.profileName);
    }

    const conversation = await upsertConversation({
        memberId: member.id,
        provider: message.provider,
        phone: normalizedPhone,
        contactName: message.profileName,
        optInStatus: nextOptStatus,
    });
    const existingInboundRecord = await findWhatsAppMessageByProviderMessageId(message.provider, message.providerMessageId);

    const inboundRecord = existingInboundRecord ?? await appendWhatsAppMessage({
        conversationId: conversation.id,
        memberId: member.id,
        provider: message.provider,
        direction: 'inbound',
        body: message.text,
        providerMessageId: message.providerMessageId,
        metadata: {
            source: 'webhook',
        },
        receivedAt: message.receivedAt,
    });

    if (!existingInboundRecord) {
        await appendWhatsAppEvent({
            messageId: inboundRecord.id,
            provider: message.provider,
            eventType: 'received',
            eventStatus: 'received',
            providerMessageId: message.providerMessageId,
            payload: message.rawPayload,
            occurredAt: message.receivedAt,
        });
    }

    await syncConversationActivity(conversation.id, {
        lastInboundAt: message.receivedAt,
        lastMessageAt: message.receivedAt,
        optInStatus: nextOptStatus,
    });

    const existingReply = await findReplyForInboundMessage(inboundRecord.id);
    if (existingReply) {
        console.info('[WhatsApp] Duplicate inbound message ignored because a reply already exists.', {
            provider: message.provider,
            providerMessageId: message.providerMessageId,
            inboundMessageId: inboundRecord.id,
            replyMessageId: existingReply.id,
        });
        return;
    }

    if (command) {
        const reply = await sendConversationReply({
            conversation,
            memberId: member.id,
            recipientName: member.full_name,
            recipientPhone: normalizedPhone,
            body: buildCommandReply(command),
            payload: {
                command,
            },
            inReplyToMessageId: inboundRecord.id,
        });
        if (!reply) {
            console.warn('[WhatsApp] Command reply was queued but not persisted as an outbound message.', {
                provider: message.provider,
                providerMessageId: message.providerMessageId,
                command,
            });
        }
        return;
    }

    if (nextOptStatus === 'opted_out') {
        const reply = await sendConversationReply({
            conversation,
            memberId: member.id,
            recipientName: member.full_name,
            recipientPhone: normalizedPhone,
            body: 'הודעות המתנ"ס מושבתות כרגע למספר הזה. כדי לחזור ולקבל מענה ועדכונים, אפשר להשיב START.',
            payload: {
                gated: 'opted_out',
            },
            inReplyToMessageId: inboundRecord.id,
        });
        if (!reply) {
            console.warn('[WhatsApp] Opt-out gated reply was queued but not persisted as an outbound message.', {
                provider: message.provider,
                providerMessageId: message.providerMessageId,
            });
        }
        return;
    }

    try {
        const history = await getConversationHistoryExcludingMessage(conversation.id, inboundRecord.id);
        const chatResponse = await getChatResponse(message.text, history);
        const reply = await sendConversationReply({
            conversation,
            memberId: member.id,
            recipientName: member.full_name,
            recipientPhone: normalizedPhone,
            body: chatResponse.response,
            payload: {
                source: 'whatsapp_chat',
                intent: chatResponse.intent,
                responseType: chatResponse.responseType,
            },
            chatResponse: chatResponse as unknown as Record<string, unknown>,
            inReplyToMessageId: inboundRecord.id,
        });

        if (!reply) {
            console.warn('[WhatsApp] AI reply delivery was queued but not persisted as an outbound message.', {
                provider: message.provider,
                providerMessageId: message.providerMessageId,
                inboundMessageId: inboundRecord.id,
            });
        }
    } catch (error) {
        console.error('[WhatsApp] Failed to generate chat reply.', {
            provider: message.provider,
            providerMessageId: message.providerMessageId,
            inboundMessageId: inboundRecord.id,
            error: error instanceof Error ? error.message : String(error),
        });

        try {
            const fallbackReply = await sendConversationReply({
                conversation,
                memberId: member.id,
                recipientName: member.full_name,
                recipientPhone: normalizedPhone,
                body: 'מצטער, הייתה לי תקלה רגעית ולא הצלחתי לענות. אפשר לנסות שוב בעוד דקה, או לנסח את השאלה מחדש.',
                payload: {
                    source: 'whatsapp_chat',
                    fallback: true,
                },
                inReplyToMessageId: inboundRecord.id,
            });

            if (!fallbackReply) {
                console.error('[WhatsApp] Failed to persist fallback reply after chat error.', {
                    provider: message.provider,
                    providerMessageId: message.providerMessageId,
                    inboundMessageId: inboundRecord.id,
                });
            }
        } catch (fallbackError) {
            console.error('[WhatsApp] Fallback reply flow failed after chat error.', {
                provider: message.provider,
                providerMessageId: message.providerMessageId,
                inboundMessageId: inboundRecord.id,
                error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
        }
    }
}

export async function handleWhatsAppStatusEvent(event: WhatsAppStatusEvent) {
    const { data: message, error: messageError } = await supabaseServer
        .from('whatsapp_messages')
        .select('*')
        .eq('provider_message_id', event.providerMessageId)
        .maybeSingle();

    if (messageError) throw messageError;

    const typedMessage = message as WhatsAppMessageRecord | null;

    if (typedMessage?.delivery_id) {
        await updateDeliveryState(typedMessage.delivery_id, {
            status: mapDeliveryStatus(event.status),
            delivered_at: event.status === 'delivered' || event.status === 'read' ? event.occurredAt : null,
            error_message: event.errorMessage ?? null,
            last_error_code: event.errorCode ?? null,
        });
    }

    await appendWhatsAppEvent({
        messageId: typedMessage?.id ?? null,
        deliveryId: typedMessage?.delivery_id ?? null,
        provider: event.provider,
        eventType: mapWhatsAppEventType(event.status),
        eventStatus: event.status,
        providerMessageId: event.providerMessageId,
        payload: event.rawPayload,
        occurredAt: event.occurredAt,
    });
}
