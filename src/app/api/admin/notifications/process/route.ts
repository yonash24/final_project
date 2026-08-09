import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { processDueDeliveries } from '@/lib/notifications/service';

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20');

    try {
        const result = await processDueDeliveries(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process notifications';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
