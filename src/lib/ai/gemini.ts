    /**
 * gemini.ts
 * Lazy-initialized Gemini AI client.
 * Using lazy init (inside functions) prevents module-level errors
 * when GOOGLE_API_KEY is not yet set during build/test environments.
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

let cachedGenAI: GoogleGenerativeAI | null = null;
let cachedChatModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;
let cachedClassifierModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (cachedGenAI) return cachedGenAI;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key') {
        throw new Error(
            'Missing GOOGLE_API_KEY — add a valid Gemini key to .env.local:\nGOOGLE_API_KEY="your-key-here"',
        );
    }
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    return cachedGenAI;
}

/**
 * Gemini 3 Flash Preview — state-of-the-art reasoning for chat.
 */
export function getChatModel() {
    if (cachedChatModel) return cachedChatModel;

    cachedChatModel = getGenAI().getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ],
    });
    return cachedChatModel;
}

/**
 * Gemini 3 Flash Preview — fast and reliable model for general tasks.
 */
export function getClassifierModel() {
    if (cachedClassifierModel) return cachedClassifierModel;

    cachedClassifierModel = getGenAI().getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
        },
    });
    return cachedClassifierModel;
}

/**
 * Gemini 3 Flash Preview — optimized for marketing content generation.
 */
export function getStudioModel() {
    return getGenAI().getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
        },
    });
}

export function getDocumentExtractionModel() {
    return getGenAI().getGenerativeModel({
        model: process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
        },
    });
}

export function getAdminCommandModel() {
    return getGenAI().getGenerativeModel({
        model: process.env.GEMINI_CHAT_MODEL || 'gemini-3-flash-preview',
        generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });
}
