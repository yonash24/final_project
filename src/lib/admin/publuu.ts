const MAX_PUBLUU_PDF_BYTES = 25 * 1024 * 1024;

export function isPubluuHost(hostname: string) {
    return /(^|\.)publuu\.com$/i.test(hostname);
}

function isCloudFrontHost(hostname: string) {
    return /(^|\.)cloudfront\.net$/i.test(hostname);
}

async function readPdfResponse(response: Response) {
    if (!response.ok) throw new Error(`Publuu לא החזיר PDF (HTTP ${response.status}).`);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_PUBLUU_PDF_BYTES) throw new Error("קובץ ה־PDF של Publuu גדול מדי.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_PUBLUU_PDF_BYTES || bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("הקישור של Publuu לא החזיר קובץ PDF תקין.");
    return new File([Buffer.from(bytes)], "publuu-source.pdf", { type: "application/pdf" });
}

export async function fetchPubluuFlipbookPdf(input: string) {
    const pageUrl = new URL(input);
    if (pageUrl.protocol !== "https:" || !isPubluuHost(pageUrl.hostname)) throw new Error("קישור החוברת של Publuu חייב להיות HTTPS תחת publuu.com.");
    const response = await fetch(pageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`לא ניתן לקרוא את חוברת Publuu (HTTP ${response.status}).`);
    const html = await response.text();
    const escapedPdf = html.match(/https?:\\\/\\\/[^"\x27\s]+\\\/pdf\\\/[^"\x27\s]+/i)?.[0];
    if (!escapedPdf) throw new Error("בחוברת Publuu אין קישור PDF זמין להורדה. הפעילו Download PDF או העלו PDF מקורי.");
    const pdfUrl = new URL(escapedPdf.replaceAll("\\/", "/").replaceAll("\\u0026", "&"));
    if (pdfUrl.protocol !== "https:" || !isCloudFrontHost(pdfUrl.hostname) || !pdfUrl.pathname.includes("/pdf/")) throw new Error("קישור ה־PDF של Publuu אינו מאובטח או אינו תקין.");
    return readPdfResponse(await fetch(pdfUrl, { signal: AbortSignal.timeout(15_000) }));
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
