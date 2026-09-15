import crypto from 'node:crypto';

import { supabaseServer } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/observability/audit';
import { normalizePhoneNumber } from '@/lib/notifications/utils';
import type { NotificationProviderName } from '@/lib/notifications/types';
import type { AdminCommand } from './admin-command';
import type { AdminProfile } from './auth';

const LINK_TTL_MS = 5 * 60_000;
const SELECTION_TTL_MS = 10 * 60_000;

function hashCode(code: string) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

export async function consumeWhatsAppRateLimit(key: string, maxRequests: number, windowSeconds = 60) {
    const rateKey = crypto.createHash('sha256').update(key).digest('hex');
    const { data, error } = await supabaseServer.rpc('consume_whatsapp_rate_limit', {
        p_rate_key: rateKey, p_max_requests: maxRequests, p_window_seconds: windowSeconds,
    });
    return !error && data === true;
}

export type LinkedAdminIdentity = {
    id: string;
    provider: 'twilio-whatsapp' | 'meta-cloud-api';
    contact_phone: string;
    admin_user_id: string;
    profile: AdminProfile;
};

export async function createAdminLinkChallenge(args: {
    profile: AdminProfile;
    provider: LinkedAdminIdentity['provider'];
    phone: string;
    request?: Request;
}) {
    const phone = normalizePhoneNumber(args.phone);
    const recentCutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await supabaseServer.from('admin_channel_link_challenges')
        .select('created_at').eq('admin_user_id', args.profile.id).eq('provider', args.provider)
        .gt('created_at', recentCutoff).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (recent) throw new Error('יש להמתין דקה לפני יצירת קוד קישור נוסף.');

    await supabaseServer.from('admin_channel_link_challenges').update({ consumed_at: new Date().toISOString() })
        .eq('admin_user_id', args.profile.id).eq('provider', args.provider).is('consumed_at', null);
    const code = String(crypto.randomInt(100000, 1000000));
    const { error } = await supabaseServer.from('admin_channel_link_challenges').insert({
        admin_user_id: args.profile.id,
        provider: args.provider,
        expected_phone: phone,
        code_hash: hashCode(code),
        expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
    });
    if (error) throw new Error('לא ניתן ליצור קוד קישור.');
    void writeAuditLog({ actor: args.profile, action: 'whatsapp.admin.link.requested', resourceType: 'admin_channel_identity', metadata: { provider: args.provider, phoneSuffix: phone.slice(-4) }, request: args.request });
    return { provider: args.provider, phone, code, expiresInSeconds: LINK_TTL_MS / 1000 };
}

export async function verifyAdminLinkChallenge(provider: NotificationProviderName, inputPhone: string, code: string) {
    if (provider !== 'twilio-whatsapp' && provider !== 'meta-cloud-api') return null;
    const phone = normalizePhoneNumber(inputPhone);
    const { data: challenge, error } = await supabaseServer.from('admin_channel_link_challenges')
        .select('id,admin_user_id,code_hash,attempts_count,expires_at,admin_users(id,email,role,is_active)')
        .eq('provider', provider).eq('expected_phone', phone).is('consumed_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !challenge) return { ok: false as const, message: 'לא נמצאה בקשת קישור פעילה למספר הזה.' };
    const linked = challenge.admin_users as unknown as AdminProfile | AdminProfile[] | null;
    const profile = Array.isArray(linked) ? linked[0] : linked;
    if (challenge.attempts_count >= 5 || new Date(challenge.expires_at) <= new Date()) {
        void writeAuditLog({ actor: profile, action: 'whatsapp.admin.link.rejected', resourceType: 'admin_channel_identity', metadata: { reason: 'expired_or_locked', provider } });
        return { ok: false as const, message: 'קוד הקישור פג או ננעל. יש ליצור קוד חדש באתר.' };
    }
    if (challenge.code_hash !== hashCode(code)) {
        await supabaseServer.from('admin_channel_link_challenges').update({ attempts_count: challenge.attempts_count + 1 }).eq('id', challenge.id).eq('attempts_count', challenge.attempts_count);
        void writeAuditLog({ actor: profile, action: 'whatsapp.admin.link.rejected', resourceType: 'admin_channel_identity', metadata: { reason: 'invalid_code', provider } });
        return { ok: false as const, message: 'קוד הקישור אינו תקין.' };
    }
    if (!profile?.is_active) return { ok: false as const, message: 'חשבון המנהל אינו פעיל.' };
    const { data: identity, error: identityError } = await supabaseServer.from('admin_channel_identities').upsert({
        admin_user_id: challenge.admin_user_id, provider, contact_phone: phone, verified_at: new Date().toISOString(),
    }, { onConflict: 'admin_user_id,provider' }).select('id').single();
    if (identityError) return { ok: false as const, message: 'המספר כבר מקושר למנהל אחר או שלא ניתן לקשר אותו.' };
    await supabaseServer.from('admin_channel_link_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id).is('consumed_at', null);
    void writeAuditLog({ actor: profile, action: 'whatsapp.admin.linked', resourceType: 'admin_channel_identity', resourceId: identity.id, metadata: { provider, phoneSuffix: phone.slice(-4) } });
    return { ok: true as const, identityId: identity.id, profile };
}

export async function getLinkedWhatsAppAdmin(provider: NotificationProviderName, inputPhone: string): Promise<LinkedAdminIdentity | null> {
    if (provider !== 'twilio-whatsapp' && provider !== 'meta-cloud-api') return null;
    const phone = normalizePhoneNumber(inputPhone);
    const { data, error } = await supabaseServer.from('admin_channel_identities')
        .select('id,provider,contact_phone,admin_user_id,admin_users(id,email,role,is_active)')
        .eq('provider', provider).eq('contact_phone', phone).maybeSingle();
    if (error || !data) return null;
    const linked = data.admin_users as unknown as AdminProfile | AdminProfile[] | null;
    const profile = Array.isArray(linked) ? linked[0] : linked;
    if (!profile?.is_active) return null;
    return { id: data.id, provider: data.provider, contact_phone: data.contact_phone, admin_user_id: data.admin_user_id, profile } as LinkedAdminIdentity;
}

export async function saveActivitySelection(args: {
    identityId: string;
    conversationId: string;
    command: AdminCommand;
    candidateIds: string[];
}) {
    await supabaseServer.from('admin_whatsapp_states').update({ consumed_at: new Date().toISOString() })
        .eq('channel_identity_id', args.identityId).eq('state_type', 'activity_selection').is('consumed_at', null);
    const { error } = await supabaseServer.from('admin_whatsapp_states').insert({
        channel_identity_id: args.identityId,
        conversation_id: args.conversationId,
        state_type: 'activity_selection',
        original_command: args.command,
        candidate_ids: args.candidateIds.slice(0, 20),
        expires_at: new Date(Date.now() + SELECTION_TTL_MS).toISOString(),
    });
    if (error) throw new Error('לא ניתן לשמור את אפשרויות הבחירה.');
}

export async function consumeActivitySelection(identityId: string, conversationId: string, selection: number) {
    const { data, error } = await supabaseServer.from('admin_whatsapp_states')
        .select('id,original_command,candidate_ids,expires_at')
        .eq('channel_identity_id', identityId).eq('conversation_id', conversationId)
        .eq('state_type', 'activity_selection').is('consumed_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data || new Date(data.expires_at) <= new Date()) return null;
    const activityId = data.candidate_ids?.[selection - 1];
    if (!activityId) return null;
    const { data: consumed } = await supabaseServer.from('admin_whatsapp_states')
        .update({ consumed_at: new Date().toISOString() }).eq('id', data.id).is('consumed_at', null).select('id').maybeSingle();
    if (!consumed) return null;
    return { command: data.original_command as AdminCommand, activityId };
}
