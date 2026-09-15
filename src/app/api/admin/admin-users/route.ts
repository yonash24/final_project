import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { writeAuditLog } from '@/lib/observability/audit';
import { supabaseServer } from '@/lib/supabase/server';

const updateSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['viewer', 'editor', 'manager', 'super_admin']),
    isActive: z.boolean(),
}).strict();

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permission = requirePermission(auth.profile, 'admin:write');
    if (permission) return permission;
    const { data, error } = await supabaseServer.from('admin_users')
        .select('id,email,role,is_active,last_login_at').order('email');
    if (error) return NextResponse.json({ error: 'לא ניתן לטעון מנהלים.' }, { status: 500 });
    return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permission = requirePermission(auth.profile, 'admin:write');
    if (permission) return permission;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'פרטי ההרשאה אינם תקינים.' }, { status: 400 });
    if (parsed.data.id === auth.profile.id && (!parsed.data.isActive || parsed.data.role !== 'super_admin')) {
        return NextResponse.json({ error: 'לא ניתן להסיר מעצמך הרשאת super_admin או להשבית את החשבון הנוכחי.' }, { status: 409 });
    }
    const { data: before } = await supabaseServer.from('admin_users').select('id,email,role,is_active').eq('id', parsed.data.id).maybeSingle();
    if (!before) return NextResponse.json({ error: 'המנהל לא נמצא.' }, { status: 404 });
    const { data, error } = await supabaseServer.from('admin_users')
        .update({ role: parsed.data.role, is_active: parsed.data.isActive })
        .eq('id', parsed.data.id).select('id,email,role,is_active,last_login_at').single();
    if (error) return NextResponse.json({ error: 'לא ניתן לעדכן את הרשאות המנהל.' }, { status: 500 });
    void writeAuditLog({ actor: auth.profile, action: 'admin.permissions.updated', resourceType: 'admin_user', resourceId: data.id, metadata: { before: { role: before.role, is_active: before.is_active }, after: { role: data.role, is_active: data.is_active } }, request });
    return NextResponse.json(data);
}
