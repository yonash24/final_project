import { NextResponse } from 'next/server';

import { getAdminProfile } from '@/lib/admin/auth';

export async function GET() {
    const profile = await getAdminProfile();

    if (!profile) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(profile);
}
