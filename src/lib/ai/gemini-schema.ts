/**
 * gemini-schema.ts
 * Converts a Zod schema into a JSON schema that Gemini's response_schema
 * actually accepts. Gemini rejects several standard JSON-schema keywords
 * (exclusiveMinimum/Maximum, additionalProperties, $schema, ...) with a
 * hard 400 — this sanitizes the output of `toJsonSchema` before it is
 * sent, and fails fast (at schema-build time, not at request time) for
 * shapes Gemini cannot represent at all (e.g. z.record()).
 */

import { toJsonSchema } from '@langchain/core/utils/json_schema';
import type { z } from 'zod';

export class GeminiSchemaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeminiSchemaError';
    }
}

const DROP_KEYS = new Set(['$schema', 'additionalProperties', 'propertyNames', 'default', 'strict', 'title', '$defs']);
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeGeminiJsonSchema(node: unknown): unknown {
    if (Array.isArray(node)) return node.map((item) => sanitizeGeminiJsonSchema(item));
    if (!isRecord(node)) return node;
    if ('$ref' in node) throw new GeminiSchemaError('$ref is not supported in a Gemini response schema.');

    const isIntegerType = node.type === 'integer';
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node)) {
        if (DROP_KEYS.has(key)) continue;
        if (key === 'exclusiveMinimum' && typeof value === 'number') {
            const minimum = isIntegerType ? value + 1 : value;
            out.minimum = typeof out.minimum === 'number' ? Math.max(out.minimum, minimum) : minimum;
            continue;
        }
        if (key === 'exclusiveMaximum' && typeof value === 'number') {
            const maximum = isIntegerType ? value - 1 : value;
            out.maximum = typeof out.maximum === 'number' ? Math.min(out.maximum, maximum) : maximum;
            continue;
        }
        out[key] = sanitizeGeminiJsonSchema(value);
    }

    if (typeof out.minimum === 'number' && Math.abs(out.minimum) === MAX_SAFE) delete out.minimum;
    if (typeof out.maximum === 'number' && Math.abs(out.maximum) === MAX_SAFE) delete out.maximum;

    if (out.type === 'object' && !('properties' in out)) {
        throw new GeminiSchemaError('An object schema without fixed "properties" (e.g. z.record()) cannot be represented as a Gemini response schema.');
    }

    return out;
}

export function toGeminiResponseSchema(schema: z.ZodType): Record<string, unknown> {
    return sanitizeGeminiJsonSchema(toJsonSchema(schema)) as Record<string, unknown>;
}
