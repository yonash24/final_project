import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    throw new Error('Missing GOOGLE_API_KEY environment variable');
}

export const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Gemini Flash model — fast, cost-effective, great for chat.
 * Used for intent classification and response generation.
 */
export function getChatModel() {
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.3,      // Lower = more deterministic, better for DB queries
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
}

/**
 * Separate model instance for intent classification.
 * Very low temperature for consistent, structured JSON output.
 */
export function getClassifierModel() {
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.1,      // Very deterministic — we need consistent JSON
            topP: 0.8,
            maxOutputTokens: 512,
            responseMimeType: 'application/json', // Force JSON output
        },
    });
}
