import { NextResponse } from 'next/server';

import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
    const checks = {
        supabase: false,
        storage: false,
        geminiConfigured: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your-gemini-api-key'),
        cronConfigured: Boolean(process.env.CRON_SECRET || process.env.NOTIFICATIONS_CRON_SECRET),
        whatsappConfigured: Boolean(
            process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
                || process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_VERIFY_TOKEN,
        ),
    };

    const [{ error: databaseError }, { error: storageError }] = await Promise.all([
        supabaseServer.from('categories').select('id').limit(1),
        supabaseServer.storage.from('activity-imports').list('', { limit: 1 }),
    ]);
    checks.supabase = !databaseError;
    checks.storage = !storageError;

    const healthy = checks.supabase && checks.geminiConfigured;
    return NextResponse.json(
        { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
        { status: healthy ? 200 : 503 },
    );
}
