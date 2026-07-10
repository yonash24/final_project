export function buildEffectiveWebhookUrl(url: string, headers: Headers) {
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');

    if (!forwardedHost) {
        return url;
    }

    const parsed = new URL(url);
    const publicHost = forwardedHost.split(',')[0].trim();

    if (publicHost.includes(':')) {
        const [hostname, port] = publicHost.split(':');
        parsed.hostname = hostname;
        parsed.port = port;
    } else {
        parsed.hostname = publicHost;
        parsed.port = '';
    }

    if (forwardedProto) {
        parsed.protocol = `${forwardedProto.split(',')[0].trim()}:`;
    }

    return parsed.toString();
}
