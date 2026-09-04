/**
 * Emergency admin bypass. Keep ADMIN_AUTH_BYPASS out of deployed environments
 * unless unrestricted admin access is explicitly intended there.
 */
export function isAdminAuthBypassEnabled() {
    return process.env.ADMIN_AUTH_BYPASS === 'true';
}
