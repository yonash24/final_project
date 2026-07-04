'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createSSRClient, supabaseServer } from '@/lib/supabase/server';

const loginSchema = z.object({
    email: z.string().email('אימייל לא תקין'),
    password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

interface LoginState {
    message: string | null;
    error: {
        email?: string[];
        password?: string[];
    } | null;
}

export async function loginAdmin(prevState: LoginState, formData: FormData): Promise<LoginState> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const validatedFields = loginSchema.safeParse({ email, password });

    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors,
            message: null,
        };
    }

    const supabase = await createSSRClient();
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) {
        console.error('Auth error:', authError);
        return { message: 'אימייל או סיסמה שגויים', error: null };
    }

    const userId = signInData.user?.id;
    if (!userId) {
        return { message: 'לא הצלחנו לזהות את המשתמש.', error: null };
    }

    const { data: adminProfile, error: adminError } = await supabaseServer
        .from('admin_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (adminError || !adminProfile) {
        await supabase.auth.signOut();
        return {
            message: 'אין לך הרשאות גישה למערכת הניהול',
            error: null,
        };
    }

    redirect('/admin');
}


export async function logoutAdmin() {
    const supabase = await createSSRClient();
    await supabase.auth.signOut();
    redirect('/admin/login');
}
