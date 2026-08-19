import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { postSchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { data, error } = await supabaseServer
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void writeAuditLog({ actor: auth.profile, action: 'post.created', resourceType: 'post', resourceId: data?.[0]?.id, request });

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabaseServer
        .from('posts')
        .insert([
            {
                ...parsed.data,
                author_name: auth.profile.email,
                author_role: 'admin',
            },
        ])
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
