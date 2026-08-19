/**
 * /api/chat/insights/route.ts
 * Server-side endpoint to log unanswered chat queries for admin analytics.
 */

export async function POST() {
    return Response.json({ error: 'This endpoint is no longer public.' }, { status: 410 });
}
