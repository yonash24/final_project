/**
 * /api/registrations/route.ts
 * Server-side endpoint to handle activity registration submissions.
 */

import { NextRequest } from 'next/server';
import { createRegistration } from '@/lib/db/chat-queries';
import { supabaseServer } from '@/lib/supabase/server';
import {
    queueRegistrationConfirmation,
    scheduleClassReminder,
} from '@/lib/notifications/service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { activity_id, full_name, phone, email, notes } = body;

        // Basic validation
        if (!activity_id || !full_name || !phone) {
            return Response.json(
                { error: 'חסרים שדות חובה (שם, טלפון או קוד חוג)' },
                { status: 400 },
            );
        }

        const data = await createRegistration({
            activity_id,
            full_name,
            phone,
            email,
            notes,
        });

        const { data: activity } = await supabaseServer
            .from('activities')
            .select('id, title_he, days_of_week, start_time, start_date, location')
            .eq('id', activity_id)
            .maybeSingle();

        if (activity) {
            const scheduleText = [
                activity.days_of_week,
                activity.start_time ? `בשעה ${String(activity.start_time).slice(0, 5)}` : null,
            ].filter(Boolean).join(' ');

            const locationText = activity.location ? `מיקום: ${activity.location}.` : '';

            await queueRegistrationConfirmation({
                registrationId: data.id,
                activityId: activity.id,
                activityTitle: activity.title_he,
                recipientName: full_name,
                recipientPhone: phone,
                scheduleText,
                locationText,
            });

            const startAt = activity.start_date
                ? `${activity.start_date}T${activity.start_time ?? '09:00:00'}`
                : null;

            await scheduleClassReminder({
                registrationId: data.id,
                activityId: activity.id,
                activityTitle: activity.title_he,
                recipientName: full_name,
                recipientPhone: phone,
                startAt,
                locationText,
            });
        }

        return Response.json({
            ok: true,
            id: data.id,
            message: 'הרשמה בוצעה בהצלחה',
        });
    } catch (error: unknown) {
        const details = error instanceof Error ? error.message : 'Unknown error';
        console.error('[RegistrationsAPI] 🛑 Error Details:', error);
        return Response.json(
            { 
                error: 'אירעה שגיאה בשמירת ההרשמה. אנא נסה שוב מאוחר יותר.',
                details
            },
            { status: 500 },
        );
    }

}
