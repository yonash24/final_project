import { NextResponse, type NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

import { createSSRClient, supabaseServer } from '@/lib/supabase/server';
import { isAdminAuthBypassEnabled } from '@/lib/admin/bypass';

export interface AdminProfile {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
}

export type AdminRole = 'super_admin' | 'editor' | 'viewer';

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
    super_admin: ['read', 'content:write', 'imports:write', 'notifications:write', 'settings:write', 'admin:write'],
    editor: ['read', 'content:write', 'imports:write', 'notifications:write'],
    viewer: ['read'],
};

export async function getCurrentUser() {
    const client = await createSSRClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
}

export async function getAdminProfile() {
    if (isAdminAuthBypassEnabled()) {
        return {
            id: 'local-admin-bypass',
            email: 'local-admin@localhost',
            role: 'super_admin',
            is_active: true,
        } satisfies AdminProfile;
    }

    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseServer
        .from('admin_users')
        .select('id, email, role, is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        // Keep login diagnosable during migration rollout. The active flag is
        // enforced as soon as migration 0015 is applied.
        const legacyResult = await supabaseServer
            .from('admin_users')
            .select('id, email, role')
            .eq('id', user.id)
            .maybeSingle();
        if (legacyResult.error || !legacyResult.data) return null;
        return { ...legacyResult.data, is_active: true } as AdminProfile;
    }

    if (!data || data.is_active === false) return null;
    return data as AdminProfile;
}

export async function requireAdmin() {
    const profile = await getAdminProfile();
    if (!profile) redirect('/admin/login');
    return profile;
}

export async function requireAdminRequest(request: NextRequest) {
    const profile = await getAdminProfile();
    if (!profile) {
        return {
            profile: null,
            request,
            response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
        };
    }
    return { profile, response: null, request };
}

export function hasPermission(profile: AdminProfile, permission: string) {
    const role = profile.role as AdminRole;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(profile: AdminProfile, permission: string) {
    if (hasPermission(profile, permission)) return null;
    return NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 },
    );
}
