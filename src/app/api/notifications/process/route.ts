import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { processDueDeliveries } from '@/lib/notifications/service';

function isAuthorizedBySecret(request: NextRequest) {
    const secret = process.env.NOTIFICATIONS_CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    return Boolean(secret && authHeader === `Bearer ${secret}`);
}

export async function POST(request: NextRequest) {
    const adminAuth = await requireAdminRequest(request);
    const allowedBySecret = isAuthorizedBySecret(request);

    if (adminAuth.response && !allowedBySecret) {
        return adminAuth.response;
    }

    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20');

    try {
        const result = await processDueDeliveries(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process notifications';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
