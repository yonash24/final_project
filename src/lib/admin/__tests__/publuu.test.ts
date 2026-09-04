import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchOfficialPubluuPdf, isPubluuHost } from '../publuu.ts';

test('isPubluuHost accepts publuu.com and its subdomains', () => {
    assert.equal(isPubluuHost('publuu.com'), true);
    assert.equal(isPubluuHost('cdn.publuu.com'), true);
    assert.equal(isPubluuHost('PUBLUU.COM'), true);
});

test('isPubluuHost rejects lookalike or unrelated hosts', () => {
    assert.equal(isPubluuHost('publuu.com.evil.example'), false);
    assert.equal(isPubluuHost('notpubluu.com'), false);
    assert.equal(isPubluuHost('example.com'), false);
});

function withMockedFetch<T>(impl: typeof fetch, run: () => Promise<T>) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return run().finally(() => {
        globalThis.fetch = original;
    });
}

function pdfBytes(sizeBytes = 10) {
    const bytes = new Uint8Array(sizeBytes);
    bytes.set(new TextEncoder().encode('%PDF-'));
    return bytes;
}

test('fetchOfficialPubluuPdf rejects a non-https or non-publuu URL', async () => {
    await assert.rejects(() => fetchOfficialPubluuPdf('http://publuu.com/file.pdf'), /HTTPS/);
    await assert.rejects(() => fetchOfficialPubluuPdf('https://not-publuu.com/file.pdf'), /HTTPS/);
});

test('fetchOfficialPubluuPdf downloads and validates a real PDF response', async () => {
    const file = await withMockedFetch(
        (async () => new Response(pdfBytes(), { status: 200, headers: { 'content-type': 'application/pdf' } })) as typeof fetch,
        () => fetchOfficialPubluuPdf('https://publuu.com/flip-book/1/download.pdf'),
    );

    assert.equal(file.type, 'application/pdf');
    assert.equal(file.name, 'publuu-source.pdf');
});

test('fetchOfficialPubluuPdf follows up to 3 redirects before giving up', async () => {
    let calls = 0;
    const file = await withMockedFetch(
        (async (input) => {
            calls += 1;
            const url = String(input);
            if (url.endsWith('/final.pdf')) {
                return new Response(pdfBytes(), { status: 200 });
            }
            const nextHop = calls >= 3 ? 'https://publuu.com/final.pdf' : `https://publuu.com/hop-${calls}.pdf`;
            return new Response(null, { status: 302, headers: { location: nextHop } });
        }) as typeof fetch,
        () => fetchOfficialPubluuPdf('https://publuu.com/start.pdf'),
    );

    assert.equal(file.name, 'publuu-source.pdf');
    assert.ok(calls <= 4, 'should not exceed the redirect budget');
});

test('fetchOfficialPubluuPdf rejects a redirect chain longer than 3 hops', async () => {
    await assert.rejects(
        () => withMockedFetch(
            (async (input) => {
                const url = String(input);
                const hop = Number(url.match(/hop-(\d+)/)?.[1] ?? '0');
                return new Response(null, { status: 302, headers: { location: `https://publuu.com/hop-${hop + 1}.pdf` } });
            }) as typeof fetch,
            () => fetchOfficialPubluuPdf('https://publuu.com/hop-0.pdf'),
        ),
        /שרשרת ההפניות/,
    );
});

test('fetchOfficialPubluuPdf rejects a response that is not a real PDF', async () => {
    await assert.rejects(
        () => withMockedFetch(
            (async () => new Response(new TextEncoder().encode('<html>not a pdf</html>'), { status: 200 })) as typeof fetch,
            () => fetchOfficialPubluuPdf('https://publuu.com/fake.pdf'),
        ),
        /קובץ PDF תקין/,
    );
});

test('fetchOfficialPubluuPdf rejects a file that is too large via content-length', async () => {
    await assert.rejects(
        () => withMockedFetch(
            (async () => new Response(pdfBytes(), { status: 200, headers: { 'content-length': String(30 * 1024 * 1024) } })) as typeof fetch,
            () => fetchOfficialPubluuPdf('https://publuu.com/huge.pdf'),
        ),
        /גדול מדי/,
    );
});

test('fetchOfficialPubluuPdf surfaces a clear error on a non-2xx response', async () => {
    await assert.rejects(
        () => withMockedFetch(
            (async () => new Response(null, { status: 404 })) as typeof fetch,
            () => fetchOfficialPubluuPdf('https://publuu.com/missing.pdf'),
        ),
        /404/,
    );
});
