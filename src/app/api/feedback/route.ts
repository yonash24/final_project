/**
 * /api/feedback/route.ts
 * API for submitting feedback after registration or event participation.
 */

import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { activity_id, event_id, registration_id, feedback_type, rating, comment, user_name, user_phone } = body;

        if (!feedback_type) {
            return Response.json({ error: 'חסר סוג משוב.' }, { status: 400 });
        }
        if (rating && (rating < 1 || rating > 5)) {
            return Response.json({ error: 'דירוג חייב להיות בין 1 ל-5.' }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from('feedback')
            .insert([{
                activity_id: activity_id || null,
                event_id: event_id || null,
                registration_id: registration_id || null,
                feedback_type,
                rating: rating || null,
                comment: comment || null,
                user_name: user_name || null,
                user_phone: user_phone || null,
            }])
            .select()
            .single();

        if (error) {
            console.error('[Feedback] Insert error:', error);
            return Response.json({ error: 'לא הצלחנו לשמור את המשוב.' }, { status: 500 });
        }

        return Response.json({ ok: true, id: data.id });
    } catch {
        return Response.json({ error: 'שגיאה בשמירת המשוב.' }, { status: 500 });
    }
}
