import { NextResponse } from 'next/server';

import { cleanupExpiredChatCache } from '@/lib/ai/chat-cache';
import { isAuthorizedCronRequest } from '@/lib/notifications/cron-auth';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
    if (!isAuthorizedCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized precompute request.' }, { status: process.env.CRON_SECRET || process.env.NOTIFICATIONS_CRON_SECRET ? 401 : 503 });
    }

    const startedAt = new Date().toISOString();
    const { data: job, error: jobError } = await supabaseServer
        .from('precompute_jobs')
        .insert({ job_type: 'cache-maintenance', status: 'running', started_at: startedAt })
        .select('id')
        .single();

    if (jobError || !job) return NextResponse.json({ error: jobError?.message ?? 'Could not create job.' }, { status: 500 });

    try {
        await cleanupExpiredChatCache();
        await supabaseServer.rpc('cleanup_chat_request_metrics');
        await supabaseServer
            .from('precompute_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString(), processed_count: 1 })
            .eq('id', job.id);
        return NextResponse.json({ ok: true, jobId: job.id });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Precompute failed.';
        await supabaseServer
            .from('precompute_jobs')
            .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 500) })
            .eq('id', job.id);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
