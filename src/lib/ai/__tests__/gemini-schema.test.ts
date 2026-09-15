import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { GeminiSchemaError, sanitizeGeminiJsonSchema, toGeminiResponseSchema } from '../gemini-schema.ts';
import { adminCommandSchema } from '../../admin/admin-command-schema.ts';
import { intentSchema } from '../recommendation-request.ts';
import { extractedDocumentSchema } from '../../admin/activity-import.ts';

function collectKeys(node: unknown, keys: Set<string>) {
    if (Array.isArray(node)) {
        for (const item of node) collectKeys(item, keys);
        return;
    }
    if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            keys.add(key);
            collectKeys(value, keys);
        }
    }
}

test('sanitizeGeminiJsonSchema strips unsupported keywords and converts exclusiveMinimum', () => {
    const schema = z.object({
        n: z.number().int().positive(),
        items: z.array(z.object({ k: z.string() })),
    });
    const result = toGeminiResponseSchema(schema) as Record<string, unknown>;
    const keys = new Set<string>();
    collectKeys(result, keys);

    for (const forbidden of ['exclusiveMinimum', 'exclusiveMaximum', 'additionalProperties', '$schema', 'default', 'propertyNames', 'strict']) {
        assert.equal(keys.has(forbidden), false, `unexpected key: ${forbidden}`);
    }
    const properties = result.properties as Record<string, { minimum?: number }>;
    assert.equal(properties.n.minimum, 1);
});

test('sanitizeGeminiJsonSchema rejects a record-shaped object schema', () => {
    const schema = z.object({ r: z.record(z.string(), z.number()) });
    assert.throws(() => toGeminiResponseSchema(schema), GeminiSchemaError);
});

test('sanitizeGeminiJsonSchema rejects $ref nodes', () => {
    assert.throws(() => sanitizeGeminiJsonSchema({ $ref: '#/$defs/Foo' }), GeminiSchemaError);
});

test('sanitizeGeminiJsonSchema drops MAX_SAFE_INTEGER noise from .int()', () => {
    const schema = z.object({ n: z.number().int().min(0).max(120) });
    const result = toGeminiResponseSchema(schema) as { properties: { n: { minimum?: number; maximum?: number } } };
    assert.equal(result.properties.n.minimum, 0);
    assert.equal(result.properties.n.maximum, 120);
});

test('real production schemas convert without throwing', () => {
    assert.doesNotThrow(() => toGeminiResponseSchema(adminCommandSchema));
    assert.doesNotThrow(() => toGeminiResponseSchema(intentSchema));
    assert.doesNotThrow(() => toGeminiResponseSchema(extractedDocumentSchema));
});
