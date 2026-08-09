/**
 * /api/registrations/route.ts
 * Server-side endpoint to handle activity registration submissions.
 */

import { NextRequest } from 'next/server';
import { createRegistration, RegistrationError } from '@/lib/db/chat-queries';
import { supabaseServer } from '@/lib/supabase/server';
import {
    ensureWhatsAppOptInFromRegistration,
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

        // The registration transaction has already committed. Notification
        // failures must not turn a successful registration into a false error.
        try {
            await ensureWhatsAppOptInFromRegistration(phone, full_name);

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
        } catch (notificationError) {
            console.error('[RegistrationsAPI] Registration succeeded but notification setup failed:', notificationError);
        }

        return Response.json({
            ok: true,
            id: data.id,
            activityId: data.activity_id,
            currentParticipants: data.current_participants,
            maxParticipants: data.max_participants,
            spotsLeft: data.max_participants == null
                ? null
                : Math.max(data.max_participants - data.current_participants, 0),
            message: 'הרשמה בוצעה בהצלחה',
        });
    } catch (error: unknown) {
        const details = error instanceof Error ? error.message : 'Unknown error';
        console.error('[RegistrationsAPI] 🛑 Error Details:', error);

        if (error instanceof RegistrationError) {
            if (error.code === 'activity_full') {
                return Response.json(
                    { error: 'החוג מלא כרגע ואין מקומות פנויים.' },
                    { status: 409 },
                );
            }

            if (error.code === 'already_registered') {
                return Response.json(
                    { error: 'כבר קיימת הרשמה פעילה למספר הטלפון הזה בחוג.' },
                    { status: 409 },
                );
            }

            if (error.code === 'activity_not_found' || error.code === 'activity_inactive') {
                return Response.json(
                    { error: 'החוג אינו זמין להרשמה.' },
                    { status: 404 },
                );
            }

            if (error.code === 'invalid_registration_input') {
                return Response.json(
                    { error: 'נא למלא שם, טלפון וקוד חוג תקינים.' },
                    { status: 400 },
                );
            }
        }

        return Response.json(
            { 
                error: 'אירעה שגיאה בשמירת ההרשמה. אנא נסה שוב מאוחר יותר.',
                details
            },
            { status: 500 },
        );
    }

}
