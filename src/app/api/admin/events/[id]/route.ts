import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { eventSchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const { id } = await params;
    const body = await request.json();
    const parsed = eventSchema.partial().safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabaseServer
        .from('events')
        .update(parsed.data)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void writeAuditLog({ actor: auth.profile, action: 'event.updated', resourceType: 'event', resourceId: id, metadata: { fields: Object.keys(parsed.data) }, request });

    return NextResponse.json(data);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const { id } = await params;
    const { error } = await supabaseServer.from('events').delete().eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void writeAuditLog({ actor: auth.profile, action: 'event.deleted', resourceType: 'event', resourceId: id, request });

    return NextResponse.json({ success: true });
}
