const MAX_PUBLUU_PDF_BYTES = 25 * 1024 * 1024;

export function isPubluuHost(hostname: string) {
    return /(^|\.)publuu\.com$/i.test(hostname);
}

export async function fetchOfficialPubluuPdf(input: string) {
    let current = new URL(input);
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        if (current.protocol !== 'https:' || !isPubluuHost(current.hostname)) {
            throw new Error('קישור PDF של Publuu חייב להיות HTTPS תחת publuu.com.');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        let response: Response;
        try {
            response = await fetch(current, { redirect: 'manual', signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location || redirectCount === 3) throw new Error('שרשרת ההפניות של Publuu אינה תקינה.');
            current = new URL(location, current);
            continue;
        }
        if (!response.ok) throw new Error(`Publuu לא החזיר PDF (HTTP ${response.status}).`);
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (contentLength > MAX_PUBLUU_PDF_BYTES) throw new Error('קובץ ה־PDF של Publuu גדול מדי.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > MAX_PUBLUU_PDF_BYTES || bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
            throw new Error('הקישור של Publuu לא החזיר קובץ PDF תקין.');
        }
        return new File([Buffer.from(bytes)], 'publuu-source.pdf', { type: 'application/pdf' });
    }
    throw new Error('לא ניתן לקרוא את קובץ ה־PDF של Publuu.');
}
