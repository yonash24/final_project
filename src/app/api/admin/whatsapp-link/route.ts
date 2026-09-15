import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';
import { createAdminLinkChallenge } from '@/lib/admin/whatsapp-admin';

const linkSchema = z.object({
    provider: z.enum(['twilio-whatsapp', 'meta-cloud-api']),
    phone: z.string().min(8).max(30),
});

export async function GET(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const { data, error } = await supabaseServer.from('admin_channel_identities')
        .select('id,provider,contact_phone,verified_at')
        .eq('admin_user_id', auth.profile.id)
        .order('provider');
    if (error) return NextResponse.json({ error: 'לא ניתן לטעון את הקישורים.' }, { status: 500 });
    return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permission = requirePermission(auth.profile, 'activity:read');
    if (permission) return permission;
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'מספר הטלפון או הספק אינם תקינים.' }, { status: 400 });
    try {
        return NextResponse.json(await createAdminLinkChallenge({
            profile: auth.profile,
            provider: parsed.data.provider,
            phone: parsed.data.phone,
            request,
        }));
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'לא ניתן ליצור קוד קישור.' }, { status: 409 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const provider = new URL(request.url).searchParams.get('provider');
    if (provider !== 'twilio-whatsapp' && provider !== 'meta-cloud-api') return NextResponse.json({ error: 'ספק לא תקין.' }, { status: 400 });
    const { error } = await supabaseServer.from('admin_channel_identities').delete()
        .eq('admin_user_id', auth.profile.id).eq('provider', provider);
    if (error) return NextResponse.json({ error: 'לא ניתן להסיר את הקישור.' }, { status: 500 });
    void writeAuditLog({ actor: auth.profile, action: 'whatsapp.admin.unlinked', resourceType: 'admin_channel_identity', metadata: { provider }, request });
    return NextResponse.json({ success: true });
}
