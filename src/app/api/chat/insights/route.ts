/**
 * /api/chat/insights/route.ts
 * Server-side endpoint to log unanswered chat queries for admin analytics.
 */

import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, intent, resultCount } = body;

        // Only log "no result" queries that are meaningful (not greetings / off-topic)
        const loggableIntents = [
            'search_activities',
            'search_events',
            'activity_details',
            'price_inquiry',
            'schedule_inquiry',
            'age_inquiry',
            'availability_inquiry',
            'general_info',
        ];

        if (!query || !loggableIntents.includes(intent)) {
            return Response.json({ ok: true });
        }

        // Upsert: count how many times the same query appeared
        const { error } = await supabaseServer.rpc('log_chat_query', {
            p_query: query.trim().toLowerCase().slice(0, 200),
            p_intent: intent,
            p_had_results: (resultCount ?? 0) > 0,
        });

        if (error) {
            // Table may not exist yet — fail silently so chat still works
            console.warn('[ChatInsights] Could not log query (table may be missing):', error.message);
        }

        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: true }); // Never break the chat
    }
}
