import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { activitySchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { ActivityChangeError, proposeActivityChange } from '@/lib/admin/activity-changes';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { data, error } = await supabaseServer
        .from('activities')
        .select('*, categories(id, name_he, icon), branches(id, name), activity_schedules(id, day_of_week, start_time, end_time)')
        .order('title_he', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const body = await request.json();
    const parsed = activitySchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
        return NextResponse.json(await proposeActivityChange({
            profile: auth.profile,
            operation: 'create',
            changes: parsed.data,
            request,
        }));
    } catch (error) {
        if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
    }
}
