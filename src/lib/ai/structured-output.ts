/**
 * structured-output.ts
 * Shared LangChain-based helper for prompting Gemini and getting back a
 * value already validated against a Zod schema, via native structured
 * output instead of prompt-engineered JSON + manual fence-stripping.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { z } from 'zod';

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
    /** Number of retries on a transient rate-limit error. Default: 2. */
    retries?: number;
}

function isRateLimitError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429') || message.includes('quota') || message.includes('rate');
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
    const model = new ChatGoogleGenerativeAI({
        apiKey: getApiKey(),
        model: options.modelName ?? 'gemini-3-flash-preview',
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        topP: options.topP,
        topK: options.topK,
    });

    const structuredModel = model.withStructuredOutput(schema);
    const content = toContentBlocks(input);
    const maxAttempts = (options.retries ?? 2) + 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            return await structuredModel.invoke(content) as z.infer<T>;
        } catch (error) {
            lastError = error;
            if (isRateLimitError(error) && attempt < maxAttempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
