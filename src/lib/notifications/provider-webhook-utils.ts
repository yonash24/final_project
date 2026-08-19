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

    if (forwardedProto) {
        parsed.protocol = `${forwardedProto.split(',')[0].trim()}:`;
    }

    return parsed.toString();
}
