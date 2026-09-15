/**
 * structured-output.ts
 * Shared LangChain-based helper for prompting Gemini and getting back a
 * value already validated against a Zod schema, via native structured
 * output instead of prompt-engineered JSON + manual fence-stripping.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AIMessage } from '@langchain/core/messages';
import type { z } from 'zod';

import { toGeminiResponseSchema } from './gemini-schema.ts';

export const DEFAULT_STRUCTURED_MODEL = 'gemini-3-flash-preview';
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_THINKING_LEVEL: GeminiThinkingLevel = 'LOW';
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1000;

// Only Gemini 3.x models support thinkingConfig; sending it to any other
// model returns an API error, so it must be gated by model name.
const THINKING_MODEL_PATTERN = /^gemini-3/;

export type GeminiThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export class StructuredOutputTruncatedError extends Error {
    constructor(message = 'Gemini response was truncated (MAX_TOKENS) before valid JSON could be produced.') {
        super(message);
        this.name = 'StructuredOutputTruncatedError';
    }
}

function getApiKey(): string {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key') {
        throw new Error(
            'Missing GOOGLE_API_KEY — add a valid Gemini key to .env.local:\nGOOGLE_API_KEY="your-key-here"',
        );
    }
    return apiKey;
}

export interface StructuredOutputFileInput {
    mimeType: string;
    data: string;
}

export type StructuredOutputInput = string | Array<string | StructuredOutputFileInput>;

export interface StructuredOutputOptions {
    modelName?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    /** Thinking budget level for Gemini 3.x models. Pass null to omit thinkingConfig entirely. Default: 'LOW'. */
    thinkingLevel?: GeminiThinkingLevel | null;
    /** Number of retries on a transient rate-limit error. Default: 2 (3 attempts total). */
    retries?: number;
    /** Base delay (ms) for exponential backoff between retries. Default: 1000. */
    retryBaseMs?: number;
}

function isRateLimitError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429') || message.includes('quota') || message.includes('rate');
}

function retryDelayMs(attempt: number, base: number) {
    return base * (2 ** (attempt + 1) - 1);
}

function toContentBlocks(input: StructuredOutputInput) {
    if (typeof input === 'string') return input;

    return input.map((part) =>
        typeof part === 'string'
            ? { type: 'text' as const, text: part }
            : { type: 'file' as const, mimeType: part.mimeType, data: part.data },
    );
}

/**
 * Prompt Gemini (via @langchain/google-genai) and return an object already
 * validated against `schema`, retrying on transient rate-limit errors.
 */
export async function generateStructuredOutput<T extends z.ZodType>(
    schema: T,
    input: StructuredOutputInput,
    options: StructuredOutputOptions = {},
): Promise<z.infer<T>> {
    const modelName = options.modelName ?? DEFAULT_STRUCTURED_MODEL;
    const thinkingLevel = options.thinkingLevel === undefined ? DEFAULT_THINKING_LEVEL : options.thinkingLevel;
    const model = new ChatGoogleGenerativeAI({
        apiKey: getApiKey(),
        model: modelName,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        topP: options.topP,
        topK: options.topK,
        ...(thinkingLevel && THINKING_MODEL_PATTERN.test(modelName)
            ? { thinkingConfig: { thinkingLevel } }
            : {}),
    });

    const responseSchema = toGeminiResponseSchema(schema);
    const structuredModel = model.withStructuredOutput(responseSchema, { includeRaw: true });
    const content = toContentBlocks(input);
    const retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    const maxAttempts = (options.retries ?? DEFAULT_RETRIES - 1) + 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const result = await structuredModel.invoke(content) as { raw: AIMessage; parsed: unknown };
            if (result.raw?.response_metadata?.finishReason === 'MAX_TOKENS') {
                throw new StructuredOutputTruncatedError();
            }
            if (result.parsed == null) {
                throw new Error('Gemini did not return a parseable structured response.');
            }
            return schema.parse(result.parsed);
        } catch (error) {
            lastError = error;
            if (isRateLimitError(error) && attempt < maxAttempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, retryBaseMs)));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
