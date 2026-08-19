import { NextResponse } from 'next/server';

import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
    const checks = {
        supabase: false,
        geminiConfigured: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your-gemini-api-key'),
        cronConfigured: Boolean(process.env.CRON_SECRET || process.env.NOTIFICATIONS_CRON_SECRET),
    };

    const { error } = await supabaseServer.from('categories').select('id').limit(1);
    checks.supabase = !error;

    const healthy = checks.supabase && checks.geminiConfigured;
    return NextResponse.json(
        { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
        { status: healthy ? 200 : 503 },
    );
}
