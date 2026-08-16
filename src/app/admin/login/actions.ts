'use server';

import { redirect } from 'next/navigation';

interface LoginState {
    message: string | null;
    error: {
        email?: string[];
        password?: string[];
    } | null;
}

export async function loginAdmin(_prevState: LoginState, _formData: FormData): Promise<LoginState> {
    redirect('/admin');
}


export async function logoutAdmin() {
    redirect('/admin');
}

