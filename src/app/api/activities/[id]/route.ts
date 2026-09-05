import { NextResponse } from 'next/server';

import { getPublicActivity } from '@/lib/db/activity-dto';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const activity = await getPublicActivity(id);
        if (!activity) return NextResponse.json({ error: 'החוג לא נמצא.' }, { status: 404 });
        return NextResponse.json(activity);
    } catch (error) {
        console.error('[Activity API] Error:', error);
        return NextResponse.json({ error: 'לא ניתן לטעון את החוג כרגע.' }, { status: 500 });
    }
}

