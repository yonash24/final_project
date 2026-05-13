import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Admin API for member management.
 * Uses supabaseServer (Service Role) to bypass RLS since the client 
 * uses a custom cookie-based auth instead of Supabase Auth.
 */

async function checkAuth() {
    const cookieStore = await cookies();
    return cookieStore.get('admin_session');
}

export async function GET(req: NextRequest) {
    if (!await checkAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseServer
        .from('members')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('[Members API] GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
    if (!await checkAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (!await checkAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { full_name, email, phone } = body;

    const { data, error } = await supabaseServer
        .from('members')
        .insert([{ full_name, email, phone, updated_at: new Date().toISOString() }])
        .select()
        .single();

    if (error) {
        console.error('[Members API] POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
