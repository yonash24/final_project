import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { eventSchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { data, error } = await supabaseServer
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void writeAuditLog({ actor: auth.profile, action: 'event.created', resourceType: 'event', resourceId: data?.[0]?.id, request });

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const body = await request.json();
    const parsed = eventSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabaseServer
        .from('events')
        .insert([parsed.data])
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
