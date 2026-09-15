/**
 * Emergency admin bypass. Keep ADMIN_AUTH_BYPASS out of deployed environments
 * unless unrestricted admin access is explicitly intended there.
 */
let warned = false;

export function isAdminAuthBypassEnabled() {
    const enabled = process.env.ADMIN_AUTH_BYPASS === 'true';

    if (enabled && process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_AUTH_BYPASS must not be enabled in production.');
    }

    if (enabled && !warned) {
        warned = true;
        console.warn('[admin] ADMIN_AUTH_BYPASS is enabled — every request is granted super_admin without login. Do not enable this outside local development.');
    }

    return enabled;
}
