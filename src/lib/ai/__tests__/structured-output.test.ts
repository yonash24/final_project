import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { generateStructuredOutput, StructuredOutputTruncatedError } from '../structured-output.ts';

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

function geminiResponse(text: string, finishReason = 'STOP') {
    return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text }] }, finishReason }],
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
            const result = await generateStructuredOutput(schema, 'hello', { retries: 2, retryBaseMs: 1 });
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
            await assert.rejects(() => generateStructuredOutput(schema, 'hello', { retries: 1, retryBaseMs: 1 }));
            assert.equal(callCount, 2);
        },
    );
});

test('generateStructuredOutput does not retry a 400 from generateContent', async () => {
    let callCount = 0;
    await withFetch(
        async () => {
            callCount += 1;
            return new Response(JSON.stringify({ error: { message: 'Request contains an invalid argument.' } }), { status: 400 });
        },
        async () => {
            await assert.rejects(() => generateStructuredOutput(schema, 'hello', { retries: 2, retryBaseMs: 1 }), /400/);
        },
    );
    assert.equal(callCount, 1);
});

test('generateStructuredOutput sends a Gemini-safe response schema (no exclusiveMinimum/record shapes)', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const positiveSchema = z.object({ n: z.number().int().positive() });
    await withFetch(
        async (_input, init) => {
            capturedBody = JSON.parse(String(init?.body));
            return geminiResponse(JSON.stringify({ n: 5 }));
        },
        async () => {
            const result = await generateStructuredOutput(positiveSchema, 'hello', { retries: 0 });
            assert.deepEqual(result, { n: 5 });
        },
    );
    assert.ok(capturedBody, 'expected a captured request body');
    const generationConfig = (capturedBody as Record<string, unknown>).generationConfig as Record<string, unknown>;
    const responseSchema = generationConfig.responseSchema as Record<string, unknown>;
    const serialized = JSON.stringify(responseSchema);
    assert.equal(serialized.includes('exclusiveMinimum'), false);
    assert.equal(serialized.includes('additionalProperties'), false);
    assert.equal(serialized.includes('$schema'), false);
});

test('generateStructuredOutput applies default maxOutputTokens and thinkingConfig for gemini-3 models', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    await withFetch(
        async (_input, init) => {
            capturedBody = JSON.parse(String(init?.body));
            return geminiResponse(JSON.stringify({ foo: 'bar' }));
        },
        async () => {
            await generateStructuredOutput(schema, 'hello', { retries: 0 });
        },
    );
    const generationConfig = (capturedBody as unknown as Record<string, unknown>).generationConfig as Record<string, unknown>;
    assert.equal(generationConfig.maxOutputTokens, 4096);
    assert.deepEqual(generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
});

test('generateStructuredOutput omits thinkingConfig for a non-thinking model', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    await withFetch(
        async (_input, init) => {
            capturedBody = JSON.parse(String(init?.body));
            return geminiResponse(JSON.stringify({ foo: 'bar' }));
        },
        async () => {
            await generateStructuredOutput(schema, 'hello', { retries: 0, modelName: 'gemini-2.5-flash' });
        },
    );
    const generationConfig = (capturedBody as unknown as Record<string, unknown>).generationConfig as Record<string, unknown>;
    assert.equal('thinkingConfig' in generationConfig, false);
});

test('generateStructuredOutput omits thinkingConfig when thinkingLevel is null', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    await withFetch(
        async (_input, init) => {
            capturedBody = JSON.parse(String(init?.body));
            return geminiResponse(JSON.stringify({ foo: 'bar' }));
        },
        async () => {
            await generateStructuredOutput(schema, 'hello', { retries: 0, thinkingLevel: null });
        },
    );
    const generationConfig = (capturedBody as unknown as Record<string, unknown>).generationConfig as Record<string, unknown>;
    assert.equal('thinkingConfig' in generationConfig, false);
});

test('generateStructuredOutput rejects a schema Gemini cannot represent before ever calling fetch', async () => {
    let callCount = 0;
    await withFetch(
        async () => { callCount += 1; return geminiResponse('{}'); },
        async () => {
            const recordSchema = z.object({ r: z.record(z.string(), z.number()) });
            await assert.rejects(() => generateStructuredOutput(recordSchema, 'hello', { retries: 0 }));
        },
    );
    assert.equal(callCount, 0);
});

test('generateStructuredOutput throws StructuredOutputTruncatedError on MAX_TOKENS without retrying', async () => {
    let callCount = 0;
    await withFetch(
        async () => { callCount += 1; return geminiResponse('{"foo":"ba', 'MAX_TOKENS'); },
        async () => {
            await assert.rejects(
                () => generateStructuredOutput(schema, 'hello', { retries: 2, retryBaseMs: 1 }),
                StructuredOutputTruncatedError,
            );
        },
    );
    assert.equal(callCount, 1);
});

test('generateStructuredOutput still rejects output that fails Zod validation', async () => {
    await withFetch(
        async () => geminiResponse(JSON.stringify({ foo: 42 })),
        async () => {
            await assert.rejects(() => generateStructuredOutput(schema, 'hello', { retries: 0 }));
        },
    );
});
