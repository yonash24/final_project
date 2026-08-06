import { NextResponse } from 'next/server';

import { getAdminProfile } from '@/lib/admin/auth';

export async function GET() {
    const profile = await getAdminProfile();
    return NextResponse.json(profile);
}
