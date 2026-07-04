import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { activitySchema } from '@/lib/admin/schemas';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { data, error } = await supabaseServer
        .from('activities')
        .select('*, categories(id, name_he, icon)')
        .order('title_he', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const parsed = activitySchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
        ...parsed.data,
        title: parsed.data.title_he,
        description: parsed.data.description_he,
        current_participants: parsed.data.current_participants ?? 0,
    };

    const { data, error } = await supabaseServer
        .from('activities')
        .insert([payload])
        .select('*, categories(id, name_he, icon)')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
