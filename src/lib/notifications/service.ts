import { z } from 'zod';

import { getNotificationProvider } from '@/lib/notifications/provider';
import { supabaseServer } from '@/lib/supabase/server';
import type {
    NotificationDeliveryRecord,
    NotificationSettingsPayload,
    NotificationSettingsRecord,
    NotificationTemplateKey,
    NotificationTemplateRecord,
} from '@/lib/notifications/types';

const notificationSettingsSchema = z.object({
    provider: z.string().min(1),
    is_enabled: z.coerce.boolean(),
    send_registration_confirmations: z.coerce.boolean(),
    send_class_reminders: z.coerce.boolean(),
    send_event_reminders: z.coerce.boolean(),
    reminder_lead_hours: z.coerce.number().int().min(1).max(168),
    admin_contact_name: z.string().default(''),
    admin_contact_phone: z.string().default(''),
    templates: z.array(
        z.object({
            template_key: z.enum([
                'registration_confirmation',
                'class_reminder',
                'event_reminder',
            ]),
            is_enabled: z.coerce.boolean(),
            body: z.string().min(10),
        }),
    ),
});

function renderTemplate(body: string, payload: Record<string, unknown>) {
    return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const value = payload[key];
        return value == null ? '' : String(value);
    }).replace(/\s+/g, ' ').trim();
}

export async function getNotificationSettings() {
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
            .select('id, channel, provider, template_key, recipient_name, recipient_phone, status, payload, rendered_body, scheduled_for, processed_at, delivered_at, error_message, created_at')
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: false })
            .limit(8),
    ]);

    if (settingsError) throw settingsError;
    if (templatesError) throw templatesError;
    if (deliveriesError) throw deliveriesError;

    return {
        settings: settings as NotificationSettingsRecord | null,
        templates: (templates ?? []) as NotificationTemplateRecord[],
        recentDeliveries: (deliveries ?? []) as NotificationDeliveryRecord[],
    };
}

export async function updateNotificationSettings(
    input: NotificationSettingsPayload,
    adminUserId: string,
) {
    const parsed = notificationSettingsSchema.parse(input);

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
            updated_by: adminUserId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'channel' });

    if (settingsError) throw settingsError;

    for (const template of parsed.templates) {
        const { error } = await supabaseServer
            .from('notification_templates')
            .update({
                body: template.body,
                is_enabled: template.is_enabled,
                updated_by: adminUserId,
                updated_at: new Date().toISOString(),
            })
            .eq('template_key', template.template_key);

        if (error) throw error;
    }

    return getNotificationSettings();
}

async function createDelivery(args: {
    templateKey: NotificationTemplateKey;
    recipientName?: string | null;
    recipientPhone: string;
    payload: Record<string, unknown>;
    relatedRegistrationId?: string | null;
    relatedActivityId?: string | null;
    relatedEventId?: string | null;
    scheduledFor?: string;
}) {
    const config = await getNotificationSettings();
    const settings = config.settings;
    const template = config.templates.find((item) => item.template_key === args.templateKey);

    if (!settings || !settings.is_enabled || !template || !template.is_enabled) {
        return null;
    }

    const renderedBody = renderTemplate(template.body, args.payload);

    const { data, error } = await supabaseServer
        .from('notification_deliveries')
        .insert([{
            channel: 'whatsapp',
            provider: settings.provider,
            template_key: args.templateKey,
            recipient_name: args.recipientName ?? null,
            recipient_phone: args.recipientPhone,
            status: 'pending',
            payload: args.payload,
            rendered_body: renderedBody,
            related_registration_id: args.relatedRegistrationId ?? null,
            related_activity_id: args.relatedActivityId ?? null,
            related_event_id: args.relatedEventId ?? null,
            scheduled_for: args.scheduledFor ?? new Date().toISOString(),
        }])
        .select('*')
        .single();

    if (error) throw error;

    return data as NotificationDeliveryRecord;
}

async function dispatchDelivery(delivery: NotificationDeliveryRecord) {
    const provider = getNotificationProvider(delivery.provider);
    const result = await provider.send({
        channel: 'whatsapp',
        deliveryId: delivery.id,
        recipientPhone: delivery.recipient_phone,
        body: delivery.rendered_body ?? '',
    });

    const { error } = await supabaseServer
        .from('notification_deliveries')
        .update({
            status: result.status,
            provider_message_id: result.providerMessageId ?? null,
            processed_at: new Date().toISOString(),
            delivered_at: result.deliveredAt ?? null,
            error_message: result.errorMessage ?? null,
        })
        .eq('id', delivery.id);

    if (error) throw error;
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
    const config = await getNotificationSettings();
    if (!config.settings?.send_registration_confirmations) {
        return;
    }

    const delivery = await createDelivery({
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
    const config = await getNotificationSettings();
    const settings = config.settings;

    if (!settings?.send_class_reminders || !input.startAt) {
        return;
    }

    const startAt = new Date(input.startAt);
    if (Number.isNaN(startAt.valueOf())) {
        return;
    }

    const scheduledFor = new Date(startAt.getTime() - settings.reminder_lead_hours * 60 * 60 * 1000).toISOString();

    await createDelivery({
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
