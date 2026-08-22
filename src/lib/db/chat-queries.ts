/**
 * chat-queries.ts
 * Pre-built Supabase queries used by the chat API
 * to fetch activities, events, and categories.
 */

import { supabaseServer } from '../supabase/server.ts';
import type { IntentFilters } from '../ai/intent-classifier.ts';
export type { IntentFilters } from '../ai/intent-classifier.ts';
import {
    buildSearchTokens,
    rankActivities,
    rankEvents,
    scoreTextMatch,
} from './chat-search-utils.ts';

// ─── Types ──────────────────────────────────────────────

export interface ActivityRow {
    id: string;
    title: string;
    title_he: string;
    description: string | null;
    description_he: string | null;
    target_age_group: string | null;
    min_age: number | null;
    max_age: number | null;
    days_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    price: number | null;
    instructor_name: string | null;
    location: string | null;
    max_participants: number | null;
    current_participants: number | null;
    is_active: boolean;
    categories: { name_he: string } | null;
}

export interface EventRow {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    type: string | null;
    category: string | null;
    max_attendees: number | null;
    current_attendees: number | null;
    is_published: boolean;
    min_age: number | null;
    max_age: number | null;
    target_age_group: string | null;
    audience_tags: string[] | null;
    is_family_friendly: boolean | null;
    requires_adult_companion: boolean | null;
}

export interface KnowledgeBaseRow {
    id: string;
    category: string;
    title_he: string;
    content_he: string;
    tags: string[] | null;
}

function mergeUniqueById<T extends { id: string }>(primary: T[], secondary: T[]) {
    const seen = new Set(primary.map((row) => row.id));
    const merged = [...primary];

    for (const row of secondary) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
    }

    return merged;
}

const ACTIVITY_SELECT = [
    'id', 'title', 'title_he', 'description', 'description_he', 'target_age_group',
    'min_age', 'max_age', 'days_of_week', 'start_time', 'end_time', 'price',
    'instructor_name', 'location', 'max_participants', 'current_participants', 'is_active',
    'categories(name_he)',
].join(', ');

const EVENT_SELECT = [
    'id', 'title', 'description', 'event_date', 'start_time', 'end_time', 'location',
    'type', 'category', 'max_attendees', 'current_attendees', 'is_published',
    'min_age', 'max_age', 'target_age_group', 'audience_tags', 'is_family_friendly', 'requires_adult_companion',
].join(', ');

// ─── Activity Queries ───────────────────────────────────

/**
 * Search activities with dynamic filters coming from the intent classifier.
 */
export async function searchActivities(
    filters: IntentFilters,
    searchTerms?: string[] | null,
    rawQuery?: string | null,
): Promise<ActivityRow[]> {
    const tokens = buildSearchTokens(rawQuery, searchTerms);

    const buildBaseQuery = () => supabaseServer
        .from('activities')
        .select(ACTIVITY_SELECT)
        .eq('is_active', true);

    const applyFilters = (query: ReturnType<typeof buildBaseQuery>) => {
        let next = query;

        if (filters.min_age_lte !== null) next = next.lte('min_age', filters.min_age_lte);
        if (filters.max_age_gte !== null) next = next.gte('max_age', filters.max_age_gte);
        if (filters.target_age_group) next = next.eq('target_age_group', filters.target_age_group);
        if (filters.days && filters.days.length > 0) {
            const dayConditions = filters.days
                .map((d) => `days_of_week.ilike.%${d}%`)
                .join(',');
            next = next.or(dayConditions);
        }
        if (filters.max_price !== null) next = next.lte('price', filters.max_price);
        if (filters.free_only) next = next.eq('price', 0);
        if (filters.category_keyword) {
            next = next.or(
                `title_he.ilike.%${filters.category_keyword}%,description_he.ilike.%${filters.category_keyword}%`,
            );
        }

        return next.order('title_he', { ascending: true }).limit(50);
    };

    const buildTextQuery = () => {
        let query = applyFilters(buildBaseQuery());

        if (tokens.length > 0) {
            const clauses = tokens
                .map((token) => [
                    `title_he.ilike.%${token}%`,
                    `description_he.ilike.%${token}%`,
                    `location.ilike.%${token}%`,
                    `instructor_name.ilike.%${token}%`,
                ].join(','))
                .join(',');
            query = query.or(clauses);
        }

        return query;
    };

    const { data, error } = await buildTextQuery();
    if (error) {
        console.error('[DB] ❌ searchActivities error:', error.message);
        return [];
    }

    let results = (data ?? []) as unknown as ActivityRow[];
    if (results.length === 0 || (tokens.length > 0 && results.length < 3)) {
        const { data: fallbackData, error: fallbackError } = await applyFilters(buildBaseQuery());
        if (fallbackError) {
            console.error('[DB] ❌ searchActivities fallback error:', fallbackError.message);
        } else {
            results = mergeUniqueById(results, (fallbackData ?? []) as unknown as ActivityRow[]);
        }
    }

    if (filters.has_spots) {
        results = results.filter(
            (a) =>
                a.max_participants === null ||
                (a.current_participants ?? 0) < a.max_participants,
        );
    }

    return rankActivities(results, tokens, filters).slice(0, 15);
}

/**
 * Get a single activity by searching its Hebrew name.
 */
export async function getActivityByName(name: string): Promise<ActivityRow | null> {
    const { data, error } = await supabaseServer
        .from('activities')
        .select(ACTIVITY_SELECT)
        .ilike('title_he', `%${name}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[ChatQueries] getActivityByName error:', error);
        return null;
    }

    return data as ActivityRow | null;
}

// ─── Event Queries ──────────────────────────────────────

/**
 * Search events with dynamic filters.
 */
export async function searchEvents(
    filters: IntentFilters,
    searchTerms?: string[] | null,
    rawQuery?: string | null,
): Promise<EventRow[]> {
    const tokens = buildSearchTokens(rawQuery, searchTerms);

    const buildBaseQuery = () => supabaseServer
        .from('events')
        .select(EVENT_SELECT)
        .eq('is_published', true);

    const today = new Date().toISOString().split('T')[0];

    const applyFilters = (query: ReturnType<typeof buildBaseQuery>) => {
        let next = query;

        if (filters.specific_date) {
            next = next.eq('event_date', filters.specific_date);
        } else if (filters.time_period) {
            const start = new Date();
            const end = new Date();

            switch (filters.time_period) {
                case 'today':
                    next = next.eq('event_date', today);
                    break;
                case 'this_week':
                    end.setDate(end.getDate() + 7);
                    next = next.gte('event_date', today).lte('event_date', end.toISOString().split('T')[0]);
                    break;
                case 'next_week':
                    start.setDate(start.getDate() + 7);
                    end.setDate(end.getDate() + 14);
                    next = next
                        .gte('event_date', start.toISOString().split('T')[0])
                        .lte('event_date', end.toISOString().split('T')[0]);
                    break;
                case 'this_month':
                    end.setMonth(end.getMonth() + 1);
                    next = next.gte('event_date', today).lte('event_date', end.toISOString().split('T')[0]);
                    break;
            }
        } else {
            next = next.gte('event_date', today);
        }

        if (filters.category_keyword) {
            next = next.or(
                `title.ilike.%${filters.category_keyword}%,description.ilike.%${filters.category_keyword}%,category.ilike.%${filters.category_keyword}%`,
            );
        }

        return next.order('event_date', { ascending: true }).limit(50);
    };

    const buildTextQuery = () => {
        let query = applyFilters(buildBaseQuery());
        if (tokens.length > 0) {
            const clauses = tokens
                .map((token) => [
                    `title.ilike.%${token}%`,
                    `description.ilike.%${token}%`,
                    `category.ilike.%${token}%`,
                    `location.ilike.%${token}%`,
                ].join(','))
                .join(',');
            query = query.or(clauses);
        }

        return query;
    };

    const { data, error } = await buildTextQuery();
    if (error) {
        console.error('[DB] ❌ searchEvents error:', error.message);
        return [];
    }

    let results = (data ?? []) as unknown as EventRow[];
    if (results.length === 0 || (tokens.length > 0 && results.length < 3)) {
        const { data: fallbackData, error: fallbackError } = await applyFilters(buildBaseQuery());
        if (fallbackError) {
            console.error('[DB] ❌ searchEvents fallback error:', fallbackError.message);
        } else {
            results = mergeUniqueById(results, (fallbackData ?? []) as unknown as EventRow[]);
        }
    }

    return rankEvents(results, tokens, filters).slice(0, 15);
}

export async function searchKnowledgeBase(
    searchText: string,
    limit: number = 5,
): Promise<KnowledgeBaseRow[]> {
    const tokens = buildSearchTokens(searchText, null);

    const buildBaseQuery = () => supabaseServer
        .from('knowledge_base')
        .select('id, category, title_he, content_he, tags')
        .eq('is_active', true)
        .order('title_he', { ascending: true })
        .limit(limit * 2);

    const buildTextQuery = () => {
        let query = buildBaseQuery();
        if (tokens.length > 0) {
            const clauses = tokens
                .map((token) => [
                    `title_he.ilike.%${token}%`,
                    `content_he.ilike.%${token}%`,
                ].join(','))
                .join(',');
            query = query.or(clauses);
        }
        return query;
    };

    const { data, error } = await buildTextQuery();

    if (error) {
        console.error('[DB] ❌ searchKnowledgeBase error:', error.message);
        return [];
    }

    const rows = (data ?? []) as KnowledgeBaseRow[];
    type KnowledgeBaseScoredRow = KnowledgeBaseRow & { score: number };

    return rows
        .map((row) => ({
            ...row,
            score:
                scoreTextMatch(row.title_he, tokens) * 1.4 +
                scoreTextMatch(row.content_he, tokens) +
                scoreTextMatch(row.tags?.join(' ') ?? null, tokens) * 0.75,
        }) as KnowledgeBaseScoredRow)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score: _score, ...row }) => row);
}

/**
 * Get upcoming events for the next N days.
 */
export async function getUpcomingEvents(days: number = 7): Promise<EventRow[]> {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const { data, error } = await supabaseServer
        .from('events')
        .select(EVENT_SELECT)
        .eq('is_published', true)
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', end.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(15);

    if (error) {
        console.error('[ChatQueries] getUpcomingEvents error:', error);
        return [];
    }

    return (data ?? []) as unknown as EventRow[];
}

// ─── Category Queries ───────────────────────────────────

export interface CategoryRow {
    id: string;
    name_he: string;
    icon: string | null;
}

/**
 * Get all categories.
 */
export async function getCategories(): Promise<CategoryRow[]> {
    const { data, error } = await supabaseServer
        .from('categories')
        .select('id, name_he, icon')
        .order('name_he', { ascending: true });

    if (error) {
        console.error('[DB] ❌ getCategories error:', error.message);
        return [];
    }

    return (data ?? []) as CategoryRow[];
}

/**
 * Get activities by category id.
 */
export async function getActivitiesByCategory(categoryId: string): Promise<ActivityRow[]> {
    const { data, error } = await supabaseServer
        .from('activities')
        .select('*, categories(name_he)')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('title_he', { ascending: true });

    if (error) {
        console.error('[ChatQueries] getActivitiesByCategory error:', error);
        return [];
    }

    return (data ?? []) as ActivityRow[];
}

// ─── Registration Queries ───────────────────────────────

export interface RegistrationInput {
    activity_id: string;
    full_name: string;
    phone: string;
    email?: string;
    notes?: string;
}

export class RegistrationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = 'RegistrationError';
    }
}

interface RegistrationRpcResult {
    registration_id: string;
    activity_id: string;
    member_id: string;
    status: string;
    current_participants: number;
    max_participants: number | null;
}

/**
 * Save a new registration to the database.
 */
export async function createRegistration(reg: RegistrationInput) {
    const { data, error } = await supabaseServer.rpc('register_for_activity', {
        p_activity_id: reg.activity_id,
        p_full_name: reg.full_name,
        p_phone: reg.phone,
        p_email: reg.email || null,
        p_notes: reg.notes || null,
    }).single();

    if (error) {
        console.error('[DB] ❌ createRegistration error:', error);
        const knownCodes = [
            'activity_full',
            'activity_not_found',
            'activity_inactive',
            'already_registered',
            'invalid_registration_input',
        ];
        const code = knownCodes.find((candidate) => error.message.includes(candidate)) ?? error.code ?? 'registration_failed';
        throw new RegistrationError(error.message, code);
    }

    if (!data) {
        throw new RegistrationError('registration_failed', 'registration_failed');
    }

    const registration = data as unknown as RegistrationRpcResult;
    console.log(`[DB] ✅ Registration created for ${reg.full_name} (ID: ${registration.registration_id})`);
    return {
        id: registration.registration_id,
        activity_id: registration.activity_id,
        member_id: registration.member_id,
        status: registration.status,
        current_participants: registration.current_participants,
        max_participants: registration.max_participants,
    };
}
