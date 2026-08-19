import { NextResponse } from 'next/server';

import { getAdminProfile } from '@/lib/admin/auth';

export async function GET() {
    const profile = await getAdminProfile();
    if (!profile) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    return NextResponse.json(profile);
}
