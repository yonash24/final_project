import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const { error } = await supabaseServer.from('posts').delete().eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
