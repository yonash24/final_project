/**
 * /api/registrations/route.ts
 * Server-side endpoint to handle activity registration submissions.
 */

import { NextRequest } from 'next/server';
import { createRegistration } from '@/lib/db/chat-queries';

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

        return Response.json({
            ok: true,
            id: data.id,
            message: 'הרשמה בוצעה בהצלחה',
        });
    } catch (error: any) {
        console.error('[RegistrationsAPI] 🛑 Error:', error.message);
        return Response.json(
            { error: 'אירעה שגיאה בשמירת ההרשמה. אנא נסה שוב מאוחר יותר.' },
            { status: 502 }, // DB likely down or table missing
        );
    }
}
