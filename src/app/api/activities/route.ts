import { NextResponse } from 'next/server';
import { listPublicActivities } from '@/lib/db/activity-dto';

export async function GET() {
  try {
    return NextResponse.json(await listPublicActivities());
  } catch (error) {
    console.error('[Activities API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
