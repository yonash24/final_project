/**
 * chat-queries.ts
 * Pre-built Supabase queries used by the chat API
 * to fetch activities, events, and categories.
 */

import { supabaseServer } from '@/lib/supabase/server';
import type { IntentFilters } from '@/lib/ai/intent-classifier';

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
}

// ─── Activity Queries ───────────────────────────────────

/**
 * Search activities with dynamic filters coming from the intent classifier.
 */
export async function searchActivities(
    filters: IntentFilters,
    searchTerms?: string[] | null,
): Promise<ActivityRow[]> {
    let query = supabaseServer
        .from('activities')
        .select('*, categories(name_he)')
        .eq('is_active', true);

    // Age filters
    if (filters.min_age_lte !== null) {
        query = query.lte('min_age', filters.min_age_lte);
    }
    if (filters.max_age_gte !== null) {
        query = query.gte('max_age', filters.max_age_gte);
    }
    if (filters.target_age_group) {
        query = query.eq('target_age_group', filters.target_age_group);
    }

    // Day-of-week filter (uses ilike on comma-separated field)
    if (filters.days && filters.days.length > 0) {
        // Build OR condition for each day
        const dayConditions = filters.days
            .map((d) => `days_of_week.ilike.%${d}%`)
            .join(',');
        query = query.or(dayConditions);
    }

    // Price filters
    if (filters.max_price !== null) {
        query = query.lte('price', filters.max_price);
    }
    if (filters.free_only) {
        query = query.eq('price', 0);
    }

    // Availability — col < col comparison not supported by Supabase REST client.
    // We filter in memory after the query (see post-filter below).

    // Category keyword (search in joined category name)
    if (filters.category_keyword) {
        query = query.or(
            `title_he.ilike.%${filters.category_keyword}%,description_he.ilike.%${filters.category_keyword}%`,
        );
    }

    // Generic text search terms
    if (searchTerms && searchTerms.length > 0) {
        const termConditions = searchTerms
            .map((t) => `title_he.ilike.%${t}%,description_he.ilike.%${t}%`)
            .join(',');
        query = query.or(termConditions);
    }

    query = query.order('title_he', { ascending: true }).limit(15);

    const { data, error } = await query;

    if (error) {
        console.error('[DB] ❌ searchActivities error:', error.message);
        return [];
    }

    // Post-filter: spots availability (can't do col < col in Supabase REST)
    let results = (data ?? []) as ActivityRow[];
    if (filters.has_spots) {
        results = results.filter(
            (a) =>
                a.max_participants === null ||
                (a.current_participants ?? 0) < a.max_participants,
        );
    }

    return results;
}

/**
 * Get a single activity by searching its Hebrew name.
 */
export async function getActivityByName(name: string): Promise<ActivityRow | null> {
    const { data, error } = await supabaseServer
        .from('activities')
        .select('*, categories(name_he)')
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
): Promise<EventRow[]> {
    let query = supabaseServer
        .from('events')
        .select('*')
        .eq('is_published', true);

    // Date-range filters
    const today = new Date().toISOString().split('T')[0];

    if (filters.specific_date) {
        query = query.eq('event_date', filters.specific_date);
    } else if (filters.time_period) {
        const start = new Date();
        const end = new Date();

        switch (filters.time_period) {
            case 'today':
                query = query.eq('event_date', today);
                break;
            case 'this_week':
                end.setDate(end.getDate() + 7);
                query = query.gte('event_date', today).lte('event_date', end.toISOString().split('T')[0]);
                break;
            case 'next_week':
                start.setDate(start.getDate() + 7);
                end.setDate(end.getDate() + 14);
                query = query
                    .gte('event_date', start.toISOString().split('T')[0])
                    .lte('event_date', end.toISOString().split('T')[0]);
                break;
            case 'this_month':
                end.setMonth(end.getMonth() + 1);
                query = query.gte('event_date', today).lte('event_date', end.toISOString().split('T')[0]);
                break;
        }
    } else {
        // Default to upcoming events (today + forward)
        query = query.gte('event_date', today);
    }

    // Category filter
    if (filters.category_keyword) {
        query = query.or(
            `title.ilike.%${filters.category_keyword}%,description.ilike.%${filters.category_keyword}%,category.ilike.%${filters.category_keyword}%`,
        );
    }

    // Text search
    if (searchTerms && searchTerms.length > 0) {
        const termConditions = searchTerms
            .map((t) => `title.ilike.%${t}%,description.ilike.%${t}%`)
            .join(',');
        query = query.or(termConditions);
    }

    query = query.order('event_date', { ascending: true }).limit(15);

    const { data, error } = await query;

    if (error) {
        console.error('[DB] ❌ searchEvents error:', error.message);
        return [];
    }

    return (data ?? []) as EventRow[];
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
        .select('*')
        .eq('is_published', true)
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', end.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(15);

    if (error) {
        console.error('[ChatQueries] getUpcomingEvents error:', error);
        return [];
    }

    return (data ?? []) as EventRow[];
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

/**
 * Save a new registration to the database.
 */
export async function createRegistration(reg: RegistrationInput) {
    const { data, error } = await supabaseServer
        .from('registrations')
        .insert([{
            activity_id: reg.activity_id,
            user_name: reg.full_name,
            user_phone: reg.phone,
            user_email: reg.email || null,
            notes: reg.notes || null,
            status: 'pending',
            created_at: new Date().toISOString(),
        }])
        .select()
        .single();

    if (error) {
        console.error('[DB] ❌ createRegistration error:', error.message);
        throw new Error(`Failed to save registration: ${error.message}`);
    }

    console.log(`[DB] ✅ Registration created for ${reg.full_name} (ID: ${data.id})`);
    return data;
}
