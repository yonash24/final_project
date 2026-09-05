import { parseActivityDocument, parseSpreadsheet } from './activity-import';
import { persistImportPreview } from './import-preview-service';
import type { AdminProfile } from './auth';
import type { WhatsAppInboundMessage } from '@/lib/notifications/types';

const MAX_BYTES = 25 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

function allowedDownloadHost(provider: WhatsAppInboundMessage['provider'], hostname: string) {
    const host = hostname.toLowerCase();
    if (provider === 'twilio-whatsapp') return host === 'api.twilio.com' || host.endsWith('.twilio.com') || host.endsWith('.twiliocdn.com');
    return host === 'lookaside.fbsbx.com' || host.endsWith('.facebook.com') || host.endsWith('.fbcdn.net') || host.endsWith('.fbsbx.com');
}

async function fetchBounded(url: string, provider: WhatsAppInboundMessage['provider'], headers: HeadersInit) {
    let current = new URL(url);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        if (current.protocol !== 'https:' || !allowedDownloadHost(provider, current.hostname)) throw new Error('כתובת הקובץ אינה מורשית.');
        const response = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location || redirects === 3) throw new Error('שרשרת ההפניות של הקובץ אינה תקינה.');
            current = new URL(location, current);
            continue;
        }
        if (!response.ok) throw new Error('לא ניתן להוריד את הקובץ מהספק.');
        const declared = Number(response.headers.get('content-length') ?? '0');
        if (declared > MAX_BYTES) throw new Error('גודל הקובץ מוגבל ל-25MB.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error('הקובץ ריק או גדול מדי.');
        return { bytes, contentType: response.headers.get('content-type')?.split(';')[0] ?? null };
    }
    throw new Error('לא ניתן להוריד את הקובץ.');
}

export async function stageWhatsAppActivityImport(message: WhatsAppInboundMessage, profile: AdminProfile) {
    const media = message.media?.[0];
    if (!media) throw new Error('לא צורף קובץ.');
    let url = media.url;
    let mimeType = media.mimeType ?? null;
    let headers: HeadersInit = {};

    if (message.provider === 'twilio-whatsapp') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!url || !accountSid || !authToken) throw new Error('חסרה הגדרת הורדת קבצים מ-Twilio.');
        headers = { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` };
    } else if (message.provider === 'meta-cloud-api') {
        const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
        if (!media.id || !accessToken) throw new Error('חסרה הגדרת הורדת קבצים מ-Meta.');
        const metadataResponse = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v22.0'}/${encodeURIComponent(media.id)}`, {
            headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000),
        });
        if (!metadataResponse.ok) throw new Error('לא ניתן לקבל את פרטי הקובץ מ-Meta.');
        const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
        if (!metadata.url || (metadata.file_size ?? 0) > MAX_BYTES) throw new Error('הקובץ אינו זמין או גדול מדי.');
        url = metadata.url;
        mimeType = metadata.mime_type ?? mimeType;
        headers = { Authorization: `Bearer ${accessToken}` };
    } else {
        throw new Error('ייבוא קבצים אינו זמין בספק המדומה.');
    }

    if (!url) throw new Error('לא התקבלה כתובת קובץ.');
    const downloaded = await fetchBounded(url, message.provider, headers);
    mimeType = mimeType ?? downloaded.contentType;
    const suppliedName = media.filename?.replace(/[^\p{L}\p{N}._-]/gu, '_') ?? '';
    const suppliedExtension = suppliedName.toLowerCase().split('.').pop() ?? '';
    const extension = ['csv', 'xlsx', 'doc', 'docx', 'pdf'].includes(suppliedExtension)
        ? suppliedExtension : MIME_EXTENSIONS[mimeType ?? ''];
    if (!extension) throw new Error('סוג הקובץ אינו נתמך. יש לשלוח Excel, CSV, Word או PDF.');
    const filename = suppliedName || `whatsapp-import-${message.providerMessageId}.${extension}`;
    const file = new File([downloaded.bytes], filename, { type: mimeType ?? 'application/octet-stream' });
    const parsedSheet = ['doc', 'docx', 'pdf'].includes(extension)
        ? await parseActivityDocument(file) : await parseSpreadsheet(file);
    if (!parsedSheet.rows.length) throw new Error('לא נמצאו חוגים בקובץ.');
    return persistImportPreview({
        file, fileBytes: downloaded.bytes, parsedSheet, mapping: parsedSheet.suggestedMapping,
        profile, sourceType: extension, publuuUrl: null,
    });
}

