import { NextRequest, NextResponse } from 'next/server';

import {
    getNotificationSettings,
    updateNotificationSettings,
} from '@/lib/notifications/service';

export async function GET(request: NextRequest) {
    try {
        const data = await getNotificationSettings();
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load notification settings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const data = await updateNotificationSettings(body);
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update notification settings';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
