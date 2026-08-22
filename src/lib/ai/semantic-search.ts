/**
 * semantic-search.ts
 * Provides vector-based semantic search across activities, events, and knowledge base.
 * Used as the RAG retrieval layer for the chat agent.
 */

import { supabaseServer } from '@/lib/supabase/server';
import { generateEmbedding } from './embeddings';
import type { ActivityRow, EventRow } from '@/lib/db/chat-queries';
import type { RecommendationRequest } from './recommendation-request';

// ─── Types ──────────────────────────────────────────────

export interface KnowledgeResult {
    id: string;
    category: string;
    title_he: string;
    content_he: string;
    tags: string[];
    similarity: number;
}

export interface SemanticSearchResults {
    activities: ActivityRow[];
    events: EventRow[];
    knowledge: KnowledgeResult[];
    hasSemanticResults: boolean;
}

interface SemanticSearchOptions {
    activityThreshold?: number;
    activityLimit?: number;
    eventThreshold?: number;
    eventLimit?: number;
    knowledgeThreshold?: number;
    knowledgeLimit?: number;
}

function logSemanticTiming(stage: string, durationMs: number, details: Record<string, unknown> = {}) {
    console.info('[ChatTiming]', JSON.stringify({
        stage,
        durationMs: Math.round(durationMs),
        ...details,
    }));
}

async function createQueryEmbedding(queryText: string): Promise<number[]> {
    const startedAt = performance.now();
    try {
        return await generateEmbedding(queryText);
    } finally {
        logSemanticTiming('embedding', performance.now() - startedAt, { embeddingCalls: 1 });
    }
}

async function searchAllWithEmbedding(
    queryText: string,
    options: Required<SemanticSearchOptions>,
): Promise<SemanticSearchResults> {
    const embedding = await createQueryEmbedding(queryText);
    const rpcStartedAt = performance.now();

    const [activitiesResult, eventsResult, knowledgeResult] = await Promise.all([
        supabaseServer.rpc('match_activities_by_embedding', {
            query_embedding: embedding,
            match_threshold: options.activityThreshold,
            match_count: options.activityLimit,
        }),
        supabaseServer.rpc('match_events_by_embedding', {
            query_embedding: embedding,
            match_threshold: options.eventThreshold,
            match_count: options.eventLimit,
        }),
        supabaseServer.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: options.knowledgeThreshold,
            match_count: options.knowledgeLimit,
        }),
    ]);

    logSemanticTiming('semantic-rpc', performance.now() - rpcStartedAt, {
        embeddingCalls: 1,
        activitiesError: activitiesResult.error?.message ?? null,
        eventsError: eventsResult.error?.message ?? null,
        knowledgeError: knowledgeResult.error?.message ?? null,
    });

    const activities = (activitiesResult.data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        title_he: row.title_he as string,
        description: row.description as string | null,
        description_he: row.description_he as string | null,
        target_age_group: row.target_age_group as string | null,
        min_age: row.min_age as number | null,
        max_age: row.max_age as number | null,
        days_of_week: row.days_of_week as string | null,
        start_time: row.start_time as string | null,
        end_time: row.end_time as string | null,
        price: row.price as number | null,
        instructor_name: row.instructor_name as string | null,
        location: row.location as string | null,
        max_participants: row.max_participants as number | null,
        current_participants: row.current_participants as number | null,
        is_active: row.is_active as boolean,
        categories: row.category_name_he ? { name_he: row.category_name_he as string } : null,
    }));

    const events = (eventsResult.data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        description: row.description as string | null,
        event_date: row.event_date as string,
        start_time: row.start_time as string | null,
        end_time: row.end_time as string | null,
        location: row.location as string | null,
        type: row.type as string | null,
        category: row.category as string | null,
        max_attendees: row.max_attendees as number | null,
        current_attendees: row.current_attendees as number | null,
        is_published: true,
        min_age: row.min_age as number | null,
        max_age: row.max_age as number | null,
        target_age_group: row.target_age_group as string | null,
        audience_tags: row.audience_tags as string[] | null,
        is_family_friendly: row.is_family_friendly as boolean | null,
        requires_adult_companion: row.requires_adult_companion as boolean | null,
    }));

    const knowledge = (knowledgeResult.data || []) as KnowledgeResult[];

    return {
        activities,
        events,
        knowledge,
        hasSemanticResults: activities.length > 0 || events.length > 0 || knowledge.length > 0,
    };
}

// ─── Semantic Search Functions ──────────────────────────

/**
 * Search activities using embedding similarity.
 */
export async function semanticSearchActivities(
    queryText: string,
    threshold: number = 0.45,
    limit: number = 8,
    request?: RecommendationRequest,
): Promise<ActivityRow[]> {
    try {
        const embedding = await generateEmbedding(queryText);

        const rpcName = request && (request.exactAge != null || request.days.length > 0 || request.maxPrice != null || request.freeOnly || request.requiresAvailability)
            ? 'match_activities_filtered' : 'match_activities_by_embedding';
        const params = rpcName === 'match_activities_filtered'
            ? { query_embedding: embedding, match_threshold: threshold, match_count: limit, exact_age: request?.exactAge ?? null, requested_days: request?.days ?? null, max_price: request?.maxPrice ?? null, free_only: request?.freeOnly ?? false, requires_availability: request?.requiresAvailability ?? false }
            : { query_embedding: embedding, match_threshold: threshold, match_count: limit };
        const { data, error } = await supabaseServer.rpc(rpcName, params);
        if (error) {
            console.warn('[SemanticSearch] Activities RPC error:', error.message);
            return [];
        }

        // Map RPC result to ActivityRow shape
        return (data || []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            title: row.title as string,
            title_he: row.title_he as string,
            description: row.description as string | null,
            description_he: row.description_he as string | null,
            target_age_group: row.target_age_group as string | null,
            min_age: row.min_age as number | null,
            max_age: row.max_age as number | null,
            days_of_week: row.days_of_week as string | null,
            start_time: row.start_time as string | null,
            end_time: row.end_time as string | null,
            price: row.price as number | null,
            instructor_name: row.instructor_name as string | null,
            location: row.location as string | null,
            max_participants: row.max_participants as number | null,
            current_participants: row.current_participants as number | null,
            is_active: row.is_active as boolean,
            categories: row.category_name_he ? { name_he: row.category_name_he as string } : null,
        }));
    } catch (err) {
        console.error('[SemanticSearch] Activities error:', err);
        return [];
    }
}

/**
 * Search all semantic collections with one shared query embedding.
 */
export async function semanticSearchAll(
    queryText: string,
    options: SemanticSearchOptions = {},
): Promise<SemanticSearchResults> {
    try {
        return await searchAllWithEmbedding(queryText, {
            activityThreshold: options.activityThreshold ?? 0.45,
            activityLimit: options.activityLimit ?? 8,
            eventThreshold: options.eventThreshold ?? 0.45,
            eventLimit: options.eventLimit ?? 5,
            knowledgeThreshold: options.knowledgeThreshold ?? 0.4,
            knowledgeLimit: options.knowledgeLimit ?? 3,
        });
    } catch (err) {
        console.error('[SemanticSearch] Combined search error:', err);
        return {
            activities: [],
            events: [],
            knowledge: [],
            hasSemanticResults: false,
        };
    }
}

/**
 * Search events using embedding similarity.
 */
export async function semanticSearchEvents(
    queryText: string,
    threshold: number = 0.45,
    limit: number = 5,
): Promise<EventRow[]> {
    try {
        const embedding = await generateEmbedding(queryText);

        const { data, error } = await supabaseServer.rpc('match_events_by_embedding', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit,
        });

        if (error) {
            console.warn('[SemanticSearch] Events RPC error:', error.message);
            return [];
        }

        return (data || []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            title: row.title as string,
            description: row.description as string | null,
            event_date: row.event_date as string,
            start_time: row.start_time as string | null,
            end_time: row.end_time as string | null,
            location: row.location as string | null,
            type: row.type as string | null,
            category: row.category as string | null,
            max_attendees: row.max_attendees as number | null,
            current_attendees: row.current_attendees as number | null,
            is_published: true,
            min_age: row.min_age as number | null,
            max_age: row.max_age as number | null,
            target_age_group: row.target_age_group as string | null,
            audience_tags: row.audience_tags as string[] | null,
            is_family_friendly: row.is_family_friendly as boolean | null,
            requires_adult_companion: row.requires_adult_companion as boolean | null,
        }));
    } catch (err) {
        console.error('[SemanticSearch] Events error:', err);
        return [];
    }
}

/**
 * Search knowledge base using embedding similarity.
 */
export async function semanticSearchKnowledge(
    queryText: string,
    threshold: number = 0.4,
    limit: number = 3,
): Promise<KnowledgeResult[]> {
    try {
        const embedding = await generateEmbedding(queryText);

        const { data, error } = await supabaseServer.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit,
        });

        if (error) {
            console.warn('[SemanticSearch] Knowledge RPC error:', error.message);
            return [];
        }

        return (data || []) as KnowledgeResult[];
    } catch (err) {
        console.error('[SemanticSearch] Knowledge error:', err);
        return [];
    }
}

/**
 * Find activities similar to a given activity ID.
 */
export async function findSimilarActivities(
    activityId: string,
    limit: number = 4,
): Promise<{ id: string; title_he: string; similarity: number }[]> {
    try {
        const { data, error } = await supabaseServer.rpc('find_similar_activities', {
            activity_id: activityId,
            match_count: limit,
        });

        if (error) {
            console.warn('[SemanticSearch] Similar activities RPC error:', error.message);
            return [];
        }

        return (data || []) as { id: string; title_he: string; similarity: number }[];
    } catch (err) {
        console.error('[SemanticSearch] Similar activities error:', err);
        return [];
    }
}

/**
 * Comprehensive semantic search across all content types.
 * This is the main entry point for RAG retrieval.
 */
export async function semanticSearch(queryText: string): Promise<SemanticSearchResults> {
    return semanticSearchAll(queryText);
}
