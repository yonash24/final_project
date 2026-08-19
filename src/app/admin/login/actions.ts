'use server';

import { redirect } from 'next/navigation';

import { getAdminProfile } from '@/lib/admin/auth';
import { writeAuditLog } from '@/lib/observability/audit';
import { createSSRClient, supabaseServer } from '@/lib/supabase/server';

export interface LoginState {
    message: string | null;
    error: {
        email?: string[];
        password?: string[];
    } | null;
}

export async function loginAdmin(_prevState: LoginState, formData: FormData): Promise<LoginState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const errors: LoginState['error'] = {};

    if (!email || !email.includes('@')) errors.email = ['נא להזין כתובת אימייל תקינה.'];
    if (!password) errors.password = ['נא להזין סיסמה.'];
    if (Object.keys(errors).length > 0) return { message: null, error: errors };

    const supabase = await createSSRClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { message: 'פרטי ההתחברות אינם נכונים.', error: null };

    const profile = await getAdminProfile();
    if (!profile) {
        await supabase.auth.signOut();
        return { message: 'אין הרשאה לחשבון זה להיכנס לאזור הניהול.', error: null };
    }

    await supabaseServer.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);
    await writeAuditLog({ actor: profile, action: 'auth.login.success' });

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.find((item) => item.status === 'verified');
        if (factor) {
            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
            if (!challengeError && challenge) {
                redirect(`/admin/login/mfa?factor=${encodeURIComponent(factor.id)}&challenge=${encodeURIComponent(challenge.id)}`);
            }
        }
    }

    redirect('/admin');
}


export async function logoutAdmin() {
    const supabase = await createSSRClient();
    await supabase.auth.signOut();
    redirect('/admin/login');
}

export interface MfaState {
    error: string | null;
}

export async function verifyMfa(_prevState: MfaState, formData: FormData): Promise<MfaState> {
    const factorId = String(formData.get('factorId') ?? '');
    const challengeId = String(formData.get('challengeId') ?? '');
    const code = String(formData.get('code') ?? '').trim();
    if (!factorId || !challengeId || !/^\d{6}$/.test(code)) return { error: 'נא להזין קוד בן 6 ספרות.' };

    const supabase = await createSSRClient();
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) return { error: 'קוד האימות אינו תקין או שפג תוקפו.' };
    if (!await getAdminProfile()) {
        await supabase.auth.signOut();
        return { error: 'אין הרשאה לחשבון זה.' };
    }
    const profile = await getAdminProfile();
    await writeAuditLog({ actor: profile, action: 'auth.mfa.success' });
    redirect('/admin');
}
