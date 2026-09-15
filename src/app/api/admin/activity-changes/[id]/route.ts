import { NextRequest, NextResponse } from 'next/server';

import { OPERATION_PERMISSION } from '@/lib/admin/activity-changes';
import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const { id } = await params;
    const { data, error } = await supabaseServer.from('activity_change_requests')
        .select('id,operation,activity_id,before_snapshot,proposed_changes,risk_level,approval_method,status,expires_at,created_at')
        .eq('id', id).eq('actor_email', auth.profile.email).maybeSingle();
    if (error) return NextResponse.json({ error: 'לא ניתן לקרוא את בקשת השינוי.' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'בקשת השינוי לא נמצאה.' }, { status: 404 });
    const permission = requirePermission(auth.profile, OPERATION_PERMISSION[data.operation as keyof typeof OPERATION_PERMISSION] ?? 'activity:publish');
    if (permission) return permission;
    if (data.approval_method !== 'web_mfa') return NextResponse.json({ error: 'הבקשה אינה דורשת אישור MFA.' }, { status: 409 });
    return NextResponse.json(data);
}
