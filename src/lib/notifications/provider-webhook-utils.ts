export function buildEffectiveWebhookUrl(url: string, headers: Headers) {
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');

    if (!forwardedHost) {
        return url;
    }

    const parsed = new URL(url);
    const publicHost = forwardedHost.split(',')[0].trim();

    // Assigning host preserves an explicitly forwarded port and also handles
    // bracketed IPv6 hosts without changing the public URL's query string.
    parsed.host = publicHost;

    // A forwarded host without a port describes the public origin. Do not
    // retain an internal development/runtime port from the raw request URL.
    if (!publicHost.includes(':')) parsed.port = '';

    if (forwardedProto) {
        parsed.protocol = `${forwardedProto.split(',')[0].trim()}:`;
    }

    return parsed.toString();
}
