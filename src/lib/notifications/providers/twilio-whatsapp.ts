import crypto from 'crypto';

import type {
    NotificationProvider,
    NotificationProviderConfig,
    NotificationSendRequest,
    NotificationSendResult,
    NotificationWebhookContext,
    NotificationWebhookParseResult,
    NotificationWebhookVerificationResult,
} from '@/lib/notifications/types';
import { buildEffectiveWebhookUrl } from '../provider-webhook-utils.ts';
import { buildProviderEnvStatus, toWhatsAppAddress } from '../utils.ts';

function buildTwilioStatusCallback(config: NotificationProviderConfig) {
    if (config.status_callback_url) {
        const callbackBase = config.status_callback_url.replace(/\/$/, '');
        if (callbackBase.endsWith('/twilio-whatsapp')) {
            return callbackBase;
        }

        return `${callbackBase}/twilio-whatsapp`;
    }

    if (process.env.APP_BASE_URL) {
        const appBase = process.env.APP_BASE_URL.replace(/\/$/, '');
        return `${appBase}/api/webhooks/whatsapp/twilio-whatsapp`;
    }

    return null;
}

function buildContentVariables(request: NotificationSendRequest) {
    if (!request.templateVariables?.length || !request.payload) {
        return null;
    }

    const variables = Object.fromEntries(
        request.templateVariables.map((variable, index) => [String(index + 1), String(request.payload?.[variable] ?? '')]),
    );

    return JSON.stringify(variables);
}

function validateTwilioSignature(context: NotificationWebhookContext) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = context.request.headers.get('x-twilio-signature');

    if (!authToken || !signature) {
        return false;
    }

    const params = new URLSearchParams(context.rawBody);
    const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const effectiveUrl = buildEffectiveWebhookUrl(context.url, context.request.headers);
    const data = `${effectiveUrl}${sorted.map(([key, value]) => `${key}${value}`).join('')}`;
    const digest = crypto.createHmac('sha1', authToken).update(data).digest('base64');
    const expectedBuffer = Buffer.from(digest);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export class TwilioWhatsAppProvider implements NotificationProvider {
    readonly name = 'twilio-whatsapp' as const;

    getHealth(config: NotificationProviderConfig) {
        const status = buildProviderEnvStatus(this.name, config, [
            ['TWILIO_ACCOUNT_SID', 'Twilio account SID for outbound API calls'],
            ['TWILIO_AUTH_TOKEN', 'Twilio auth token for API calls and webhook validation'],
        ]);

        if (!config.twilio_from_number) {
            status.warnings.push('Provider config is missing the WhatsApp-enabled Twilio sender number.');
        }

        status.isConfigured = status.isConfigured && Boolean(config.twilio_from_number);
        return status;
    }

    async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = request.providerConfig.twilio_from_number;

        if (!accountSid || !authToken || !fromNumber) {
            return {
                status: 'failed',
                errorCode: 'twilio_not_configured',
                errorMessage: 'Twilio WhatsApp provider is missing required configuration.',
                shouldRetry: false,
            };
        }

        const statusCallback = buildTwilioStatusCallback(request.providerConfig);
        const form = new URLSearchParams({
            To: toWhatsAppAddress(request.recipientPhone),
            From: toWhatsAppAddress(fromNumber),
        });

        const contentSid = request.templateKey
            ? request.providerConfig.twilio_content_sids?.[request.templateKey]
            : undefined;

        if (request.templateKey && !contentSid) {
            return {
                status: 'failed',
                errorCode: 'twilio_template_not_configured',
                errorMessage: `No approved Twilio Content SID is configured for ${request.templateKey}.`,
                shouldRetry: false,
            };
        }

        if (contentSid) {
            form.set('ContentSid', contentSid);
            const contentVariables = buildContentVariables(request);
            if (contentVariables) form.set('ContentVariables', contentVariables);
        } else {
            form.set('Body', request.body);
        }

        if (statusCallback) {
            form.set('StatusCallback', statusCallback);
        }

        try {
            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: form.toString(),
            });
            const payload = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                return {
                    status: 'failed',
                    errorCode: typeof payload.code === 'number' ? String(payload.code) : 'twilio_send_failed',
                    errorMessage: typeof payload.message === 'string' ? payload.message : 'Twilio send failed.',
                    shouldRetry: response.status >= 500 || response.status === 429,
                    providerResponse: payload,
                };
            }

            return {
                status: 'sent',
                providerMessageId: typeof payload.sid === 'string' ? payload.sid : undefined,
                providerResponse: payload,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Twilio error';
            return {
                status: 'failed',
                errorCode: 'twilio_network_error',
                errorMessage: message,
                shouldRetry: true,
            };
        }
    }

    async verifyWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookVerificationResult> {
        return {
            ok: validateTwilioSignature(context),
            status: 403,
            errorMessage: 'Invalid Twilio signature.',
        };
    }

    async parseWebhook(context: NotificationWebhookContext): Promise<NotificationWebhookParseResult> {
        const form = new URLSearchParams(context.rawBody);
        const messageSid = form.get('MessageSid') ?? form.get('SmsSid') ?? crypto.randomUUID();
        const profileName = form.get('ProfileName');
        const from = form.get('From') ?? '';
        const body = form.get('Body') ?? '';
        const messageStatus = form.get('MessageStatus') ?? form.get('SmsStatus');
        const timestamp = form.get('Timestamp');
        const parsedTimestamp = timestamp ? new Date(timestamp) : null;
        const occurredAt = parsedTimestamp && !Number.isNaN(parsedTimestamp.valueOf())
            ? parsedTimestamp.toISOString()
            : new Date().toISOString();
        const mediaCount = Number(form.get('NumMedia') ?? '0');
        const media = Array.from({ length: Number.isFinite(mediaCount) ? Math.min(mediaCount, 5) : 0 }, (_, index) => ({
            url: form.get(`MediaUrl${index}`) ?? undefined,
            mimeType: form.get(`MediaContentType${index}`),
            filename: null,
        })).filter((item) => item.url);

        if (messageStatus && form.get('Body') === null) {
            return {
                inboundMessages: [],
                statusEvents: [{
                    provider: this.name,
                    providerMessageId: messageSid,
                    status: messageStatus,
                    occurredAt,
                    rawPayload: Object.fromEntries(form.entries()),
                    errorCode: form.get('ErrorCode'),
                    errorMessage: form.get('ErrorMessage'),
                }],
            };
        }

        return {
            inboundMessages: [{
                provider: this.name,
                providerMessageId: messageSid,
                fromPhone: from,
                profileName,
                text: body,
                receivedAt: occurredAt,
                rawPayload: Object.fromEntries(form.entries()),
                ...(media.length ? { media } : {}),
            }],
            statusEvents: [],
        };
    }
}
