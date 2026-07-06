/**
 * /api/activities/[id]/similar/route.ts
 * Returns activities similar to the given activity using vector similarity.
 */

import { NextRequest } from 'next/server';
import { findSimilarActivities } from '@/lib/ai/semantic-search';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ error: 'Missing activity ID' }, { status: 400 });
        }

        const similar = await findSimilarActivities(id, 4);
        return Response.json({ similar });
    } catch (error) {
        console.error('[SimilarActivities] Error:', error);
        return Response.json({ error: 'Failed to find similar activities' }, { status: 500 });
    }
}
