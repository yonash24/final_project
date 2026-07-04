import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import {
    getNotificationSettings,
    updateNotificationSettings,
} from '@/lib/notifications/service';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    try {
        const data = await getNotificationSettings();
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load notification settings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    try {
        const body = await request.json();
        const data = await updateNotificationSettings(body, auth.profile.id);
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update notification settings';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
