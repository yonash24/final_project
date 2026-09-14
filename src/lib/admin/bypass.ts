/**
 * Emergency admin bypass. Keep ADMIN_AUTH_BYPASS out of deployed environments
 * unless unrestricted admin access is explicitly intended there.
 */
export function isAdminAuthBypassEnabled() {
    const enabled = process.env.ADMIN_AUTH_BYPASS === 'true';

    if (enabled && process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_AUTH_BYPASS must not be enabled in production.');
    }

    return enabled;
}
