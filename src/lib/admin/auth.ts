import { type NextRequest } from 'next/server';

export interface AdminProfile {
    id: string;
    email: string;
    role: string;
}

const OPEN_ADMIN_PROFILE: AdminProfile = {
    id: 'public-access',
    email: 'public-access@local',
    role: 'admin',
};

export async function getAdminProfile() {
    return OPEN_ADMIN_PROFILE;
}

export async function requireAdmin() {
    return getAdminProfile();
}

export async function requireAdminRequest(request: NextRequest) {
    const profile = await getAdminProfile();
    return { profile, response: null, request };
}
