import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseServer } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AdminProfile {
    id: string;
    email: string;
    role: string;
}

export async function getAdminProfile() {
    const cookieStore = await cookies();
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value;
            },
            set() {
                // No-op in read-only helpers.
            },
            remove() {
                // No-op in read-only helpers.
            },
        },
    });

    const {
        data: { user },
        error,
    } = await client.auth.getUser();

    if (error || !user) {
        return null;
    }

    const { data: adminProfile, error: profileError } = await supabaseServer
        .from('admin_users')
        .select('id, email, role')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !adminProfile) {
        return null;
    }

    return adminProfile as AdminProfile;
}

export async function requireAdmin() {
    const profile = await getAdminProfile();

    if (!profile) {
        throw new Error('Unauthorized');
    }

    return profile;
}

export async function requireAdminRequest(request: NextRequest) {
    const profile = await getAdminProfile();

    if (!profile) {
        return {
            profile: null,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    return { profile, response: null, request };
}
