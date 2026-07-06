/**
 * /api/admin/insights/route.ts
 * API for fetching chat insights data for the admin dashboard.
 */

import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
    try {
        // Get all query logs, ordered by frequency
        const { data: queryLogs, error: queryError } = await supabaseServer
            .from('chat_query_logs')
            .select('*')
            .order('hit_count', { ascending: false })
            .limit(100);

        if (queryError) {
            console.warn('[AdminInsights] Query logs error:', queryError.message);
        }

        const logs = queryLogs || [];

        // Compute aggregates
        const totalQueries = logs.reduce((sum, l) => sum + (l.hit_count || 1), 0);
        const unansweredQueries = logs.filter((l) => !l.had_results);
        const answeredQueries = logs.filter((l) => l.had_results);

        // Intent distribution
        const intentCounts: Record<string, number> = {};
        for (const log of logs) {
            const intent = log.intent || 'unknown';
            intentCounts[intent] = (intentCounts[intent] || 0) + (log.hit_count || 1);
        }

        // Top unanswered (most repeated failed searches)
        const topUnanswered = unansweredQueries
            .sort((a, b) => (b.hit_count || 1) - (a.hit_count || 1))
            .slice(0, 20);

        // Top popular (most frequent queries)
        const topPopular = logs
            .sort((a, b) => (b.hit_count || 1) - (a.hit_count || 1))
            .slice(0, 20);

        // Recent queries (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentQueries = logs.filter((l) => new Date(l.last_seen_at) >= weekAgo);

        return Response.json({
            totalQueries,
            totalUniqueQueries: logs.length,
            answeredRate: totalQueries > 0 ? (answeredQueries.reduce((s, l) => s + (l.hit_count || 1), 0) / totalQueries * 100).toFixed(1) : '0',
            intentDistribution: Object.entries(intentCounts)
                .map(([intent, count]) => ({ intent, count }))
                .sort((a, b) => b.count - a.count),
            topUnanswered: topUnanswered.map((l) => ({
                query: l.query,
                intent: l.intent,
                hitCount: l.hit_count,
                lastSeen: l.last_seen_at,
            })),
            topPopular: topPopular.map((l) => ({
                query: l.query,
                intent: l.intent,
                hitCount: l.hit_count,
                hadResults: l.had_results,
                lastSeen: l.last_seen_at,
            })),
            recentCount: recentQueries.length,
        });
    } catch (error) {
        console.error('[AdminInsights] Error:', error);
        return Response.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }
}
