import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { activitySchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';
import { invalidateChatCache } from '@/lib/ai/chat-cache';

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
    const expectedUpdatedAt = typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null;
    if (!expectedUpdatedAt) return NextResponse.json({ error: 'יש לרענן את החוג לפני עדכון.' }, { status: 428 });
    const { expected_updated_at: _expected, ...activityBody } = body;
    void _expected;
    const parsed = activitySchema.partial().safeParse(activityBody);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
        ...parsed.data,
        ...(parsed.data.title_he ? { title: parsed.data.title_he } : {}),
        ...(parsed.data.description_he ? { description: parsed.data.description_he } : {}),
    };

    const { data: before } = await supabaseServer.from('activities').select('*').eq('id', id).maybeSingle();
    const { data, error } = await supabaseServer
        .from('activities')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('updated_at', expectedUpdatedAt)
        .select('*, categories(id, name_he, icon)')
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'החוג השתנה מאז שנפתח. נא לרענן ולנסות שוב.' }, { status: 409 });

    void writeAuditLog({ actor: auth.profile, action: 'activity.updated', resourceType: 'activity', resourceId: id, metadata: { before, after: data, fields: Object.keys(parsed.data) }, request });
    void invalidateChatCache();

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
    const body = await request.json().catch(() => ({}));
    const expectedUpdatedAt = typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null;
    if (!expectedUpdatedAt) return NextResponse.json({ error: 'יש לרענן את החוג לפני העברה לארכיון.' }, { status: 428 });
    const { data: before } = await supabaseServer.from('activities').select('*').eq('id', id).maybeSingle();
    const archivedAt = new Date().toISOString();
    const { data, error } = await supabaseServer.from('activities').update({
        is_active: false,
        publication_status: 'archived',
        archived_at: archivedAt,
        updated_at: archivedAt,
    }).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'החוג השתנה מאז שנפתח. נא לרענן ולנסות שוב.' }, { status: 409 });

    void writeAuditLog({ actor: auth.profile, action: 'activity.archived', resourceType: 'activity', resourceId: id, metadata: { before }, request });
    void invalidateChatCache();

    return NextResponse.json({ success: true });
}
