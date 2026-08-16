import { supabaseServer } from '@/lib/supabase/server';

function normalizeWhatsAppNumber(value: string | null | undefined) {
    const normalized = value?.replace(/^whatsapp:/i, '').replace(/\D/g, '');
    return normalized || null;
}

export async function GET() {
    const configuredNumber = normalizeWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_CHAT_NUMBER);

    if (configuredNumber) {
        return Response.json({ phoneNumber: configuredNumber });
    }

    const { data, error } = await supabaseServer
        .from('notification_settings')
        .select('provider, admin_contact_phone, provider_config')
        .eq('channel', 'whatsapp')
        .maybeSingle();

    if (error) {
        console.error('[WhatsAppContact] Failed to load public contact number.', error);
        return Response.json({ phoneNumber: null }, { status: 200 });
    }

    const providerConfig = data?.provider_config as { twilio_from_number?: string } | null;
    const phoneNumber = normalizeWhatsAppNumber(
        providerConfig?.twilio_from_number || data?.admin_contact_phone,
    );

    return Response.json({ phoneNumber });
}
