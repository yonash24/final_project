'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';


const loginSchema = z.object({
    email: z.string().email('אימייל לא תקין'),
    password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

export async function loginAdmin(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const validatedFields = loginSchema.safeParse({ email, password });

    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors,
        };
    }

    // Use RPC to verify credentials from custom management_users table
    const { data: verifiedUsers, error: authError } = await supabaseServer.rpc('verify_admin_password', {
        p_email: email,
        p_password: password
    });

    if (authError) {
        console.error('Auth error:', authError);
        return { message: 'שגיאת שרת פנימית' };
    }

    const user = Array.isArray(verifiedUsers) ? verifiedUsers[0] : verifiedUsers;

    if (!user) {
        return {
            message: 'אימייל או סיסמה שגויים',
        };
    }

    const cookieStore = await cookies();
    
    // Set a simple session cookie (In production, use a signed JWT)
    cookieStore.set('admin_session', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
    });

    redirect('/admin');
}


export async function logoutAdmin() {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    redirect('/admin/login');
}

