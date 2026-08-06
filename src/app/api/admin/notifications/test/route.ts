import { NextRequest, NextResponse } from 'next/server';

import { sendTestNotification } from '@/lib/notifications/service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = await sendTestNotification(body);
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send test notification';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
