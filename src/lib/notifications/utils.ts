import type {
    NotificationProviderConfig,
    NotificationProviderHealth,
    NotificationProviderName,
    NotificationTemplateKey,
    WhatsAppOptInStatus,
} from '@/lib/notifications/types';

const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'הסר', 'בטל', 'עצור']);
const OPT_IN_KEYWORDS = new Set(['start', 'subscribe', 'unstop', 'yes', 'התחל', 'אשר', 'כן']);
const HELP_KEYWORDS = new Set(['help', 'info', 'עזרה']);

export function renderTemplate(body: string, payload: Record<string, unknown>) {
    return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const value = payload[key];
        return value == null ? '' : String(value);
    }).replace(/\s+/g, ' ').trim();
}

export function normalizePhoneNumber(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('whatsapp:')) {
        return trimmed.slice('whatsapp:'.length);
    }

    if (trimmed.startsWith('+')) {
        return `+${trimmed.slice(1).replace(/\D/g, '')}`;
    }

    return `+${trimmed.replace(/\D/g, '')}`;
}

export function toWhatsAppAddress(value: string) {
    const normalized = normalizePhoneNumber(value);
    return normalized.startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`;
}

export function detectOptCommand(text: string): 'opt_in' | 'opt_out' | 'help' | null {
    const normalized = text.trim().toLowerCase();
    if (OPT_OUT_KEYWORDS.has(normalized)) return 'opt_out';
    if (OPT_IN_KEYWORDS.has(normalized)) return 'opt_in';
    if (HELP_KEYWORDS.has(normalized)) return 'help';
    return null;
}

export function getRetryDelayMs(attempt: number) {
    const delays = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
    return delays[Math.min(attempt, delays.length - 1)];
}

export function shouldSuppressOutbound(optInStatus: WhatsAppOptInStatus) {
    return optInStatus === 'opted_out';
}

export function buildProviderEnvStatus(
    provider: NotificationProviderName,
    config: NotificationProviderConfig,
    requirements: Array<[string, string]>,
): NotificationProviderHealth {
    const requiredEnvVars = requirements.map(([name, description]) => ({
        name,
        present: Boolean(process.env[name]),
        description,
    }));
    const warnings: string[] = [];

    if (!config.status_callback_url && !process.env.APP_BASE_URL) {
        warnings.push('APP_BASE_URL is missing, so provider status callbacks may be unavailable.');
    }

    return {
        provider,
        mode: provider === 'mock-whatsapp' ? 'mock' : 'live',
        isConfigured: requiredEnvVars.every((entry) => entry.present),
        requiredEnvVars,
        warnings,
    };
}

export function getTestMessageForTemplate(templateKey: NotificationTemplateKey) {
    switch (templateKey) {
        case 'registration_confirmation':
            return {
                name: 'דנה',
                activity_title: 'יוגה קהילתית',
                schedule_text: 'ימי שני בשעה 18:00.',
                location_text: 'מיקום: אולם הספורט.',
            };
        case 'class_reminder':
            return {
                name: 'דנה',
                activity_title: 'יוגה קהילתית',
                start_at: new Date().toLocaleString('he-IL'),
                location_text: 'מיקום: אולם הספורט.',
            };
        case 'event_reminder':
            return {
                name: 'דנה',
                event_title: 'ערב קהילתי',
                start_at: new Date().toLocaleString('he-IL'),
                location_text: 'מיקום: רחבת המתנ"ס.',
            };
        case 'change_notification':
            return {
                name: 'דנה',
                subject: 'שיעור יוגה',
                change_summary: 'המפגש הועבר ליום שלישי בשעה 19:00.',
                contact_name: 'צוות המתנ"ס',
                contact_phone: '+972501234567',
            };
    }
}
