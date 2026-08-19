import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { memberSchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { data, error } = await supabaseServer
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Members API] GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAdminRequest(req);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const { error } = await supabaseServer
        .from('members')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Members API] DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
    const auth = await requireAdminRequest(req);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'content:write');
    if (permissionResponse) return permissionResponse;

    const body = await req.json();
    const parsed = memberSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: z.flattenError(parsed.error) },
            { status: 400 },
        );
    }

    const { data, error } = await supabaseServer
        .from('members')
        .insert([parsed.data])
        .select()
        .single();

    if (error) {
        console.error('[Members API] POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
