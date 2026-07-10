/**
 * embeddings.ts
 * Utility for generating text embeddings using a supported Gemini embedding model.
 * Used for semantic search / RAG across activities, events, and knowledge base.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (_genAI) return _genAI;
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Missing GOOGLE_API_KEY for embeddings');
    _genAI = new GoogleGenerativeAI(apiKey);
    return _genAI;
}

/**
 * Generate a 768-dim embedding for the given text using Gemini.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const request = {
        content: {
            role: 'user',
            parts: [{ text }],
        },
        // The live API accepts outputDimensionality even though the installed SDK types do not.
        outputDimensionality: 768,
    } as unknown as Parameters<typeof model.embedContent>[0];

    const result = await model.embedContent(request);
    return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts in sequence (respects rate limits).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
        const embedding = await generateEmbedding(text);
        embeddings.push(embedding);
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
    }
    return embeddings;
}

/**
 * Build a searchable text string from an activity row.
 * Combines all meaningful fields for embedding.
 */
export function buildActivityEmbeddingText(activity: {
    title_he: string;
    description_he?: string | null;
    target_age_group?: string | null;
    days_of_week?: string | null;
    location?: string | null;
    instructor_name?: string | null;
    category_name_he?: string | null;
}): string {
    const parts = [
        activity.title_he,
        activity.description_he || '',
        activity.target_age_group ? `קבוצת גיל: ${ageGroupHe(activity.target_age_group)}` : '',
        activity.days_of_week ? `ימים: ${activity.days_of_week}` : '',
        activity.location ? `מיקום: ${activity.location}` : '',
        activity.instructor_name ? `מדריך: ${activity.instructor_name}` : '',
        activity.category_name_he ? `קטגוריה: ${activity.category_name_he}` : '',
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Build searchable text for an event row.
 */
export function buildEventEmbeddingText(event: {
    title: string;
    description?: string | null;
    location?: string | null;
    category?: string | null;
    type?: string | null;
}): string {
    const parts = [
        event.title,
        event.description || '',
        event.location ? `מיקום: ${event.location}` : '',
        event.category ? `קטגוריה: ${event.category}` : '',
        event.type ? `סוג: ${event.type}` : '',
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Build searchable text for a knowledge base entry.
 */
export function buildKnowledgeEmbeddingText(kb: {
    title_he: string;
    content_he: string;
    category?: string;
    tags?: string[];
}): string {
    const parts = [
        kb.title_he,
        kb.content_he,
        kb.category ? `קטגוריה: ${kb.category}` : '',
        kb.tags && kb.tags.length > 0 ? `תגיות: ${kb.tags.join(', ')}` : '',
    ];
    return parts.filter(Boolean).join('. ');
}

function ageGroupHe(group: string): string {
    const map: Record<string, string> = {
        kids: 'ילדים',
        teens: 'נוער',
        adults: 'מבוגרים',
        seniors: 'גיל שלישי',
    };
    return map[group] || group;
}
