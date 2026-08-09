import crypto from 'crypto';

export function getConfiguredCronSecret() {
    return process.env.NOTIFICATIONS_CRON_SECRET || process.env.CRON_SECRET || '';
}

export function isAuthorizedCronRequest(request: Request) {
    const configuredSecret = getConfiguredCronSecret();
    if (!configuredSecret) return false;

    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const headerSecret = request.headers.get('x-cron-secret') || '';
    const providedSecret = bearer || headerSecret;

    const expected = Buffer.from(configuredSecret);
    const actual = Buffer.from(providedSecret);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
