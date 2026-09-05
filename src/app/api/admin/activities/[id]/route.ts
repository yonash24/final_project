import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { activitySchema } from '@/lib/admin/schemas';
import { ActivityChangeError, proposeActivityChange } from '@/lib/admin/activity-changes';

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

    try {
        return NextResponse.json(await proposeActivityChange({
            profile: auth.profile,
            operation: 'update',
            activityId: id,
            expectedUpdatedAt,
            changes: parsed.data,
            request,
        }));
    } catch (error) {
        if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
    }
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
    try {
        return NextResponse.json(await proposeActivityChange({
            profile: auth.profile,
            operation: 'archive',
            activityId: id,
            expectedUpdatedAt,
            request,
        }));
    } catch (error) {
        if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
    }
}
