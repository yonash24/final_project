import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { activitySchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = activitySchema.partial().safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
        ...parsed.data,
        ...(parsed.data.title_he ? { title: parsed.data.title_he } : {}),
        ...(parsed.data.description_he ? { description: parsed.data.description_he } : {}),
    };

    const { data, error } = await supabaseServer
        .from('activities')
        .update(payload)
        .eq('id', id)
        .select('*, categories(id, name_he, icon)')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const { error } = await supabaseServer.from('activities').delete().eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
