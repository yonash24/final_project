import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { generateStructuredOutput } from '../structured-output.ts';

function withFetch(handler: typeof fetch, fn: () => Promise<void>) {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-key';
    globalThis.fetch = handler;

    return fn().finally(() => {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GOOGLE_API_KEY;
        else process.env.GOOGLE_API_KEY = originalKey;
    });
}

function geminiResponse(text: string) {
    return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    }), { status: 200 });
}

const schema = z.object({ foo: z.string() });

test('generateStructuredOutput returns a value validated against the schema', async () => {
    await withFetch(
        async () => geminiResponse(JSON.stringify({ foo: 'bar' })),
        async () => {
            const result = await generateStructuredOutput(schema, 'hello', { retries: 0 });
            assert.deepEqual(result, { foo: 'bar' });
        },
    );
});

test('generateStructuredOutput retries on a rate-limit error then succeeds', async () => {
    let callCount = 0;
    await withFetch(
        async () => {
            callCount += 1;
            if (callCount === 1) {
                return new Response(JSON.stringify({ error: { message: 'rate limit exceeded' } }), { status: 429 });
            }
            return geminiResponse(JSON.stringify({ foo: 'bar' }));
        },
        async () => {
            const result = await generateStructuredOutput(schema, 'hello', { retries: 2 });
            assert.deepEqual(result, { foo: 'bar' });
            assert.equal(callCount, 2);
        },
    );
});

test('generateStructuredOutput throws once retries are exhausted', async () => {
    let callCount = 0;
    await withFetch(
        async () => {
            callCount += 1;
            return new Response(JSON.stringify({ error: { message: 'rate limit exceeded' } }), { status: 429 });
        },
        async () => {
            await assert.rejects(() => generateStructuredOutput(schema, 'hello', { retries: 1 }));
            assert.equal(callCount, 2);
        },
    );
});
