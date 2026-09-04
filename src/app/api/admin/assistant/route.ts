import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { parseAdminCommand } from '@/lib/admin/admin-command';
import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { getChatResponse } from '@/lib/ai/chat-service';
import { getActivitiesByName } from '@/lib/db/chat-queries';
import { writeAuditLog } from '@/lib/observability/audit';
import { supabaseServer } from '@/lib/supabase/server';
import { invalidateChatCache } from '@/lib/ai/chat-cache';
import { DataSourceUnavailableError } from '@/lib/db/data-source';

function actorId(value: string) { return /^[0-9a-f-]{36}$/i.test(value) ? value : null; }
function hashNonce(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }
type ClaimedChangeRequest = {
    id: string;
    expires_at: string;
    operation: 'create' | 'update' | 'archive';
    activity_id: string | null;
    proposed_changes: Record<string, unknown>;
    expected_updated_at: string | null;
    before_snapshot: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const body = await request.json();

    if (body.action === 'confirm') {
        const permission = requirePermission(auth.profile, 'content:write');
        if (permission) return permission;
        const token = typeof body.token === 'string' ? body.token : '';
        const { data: claimed, error: claimError } = await supabaseServer.rpc('claim_activity_change_request', {
            p_nonce_hash: hashNonce(token),
            p_actor_email: auth.profile.email,
        }).maybeSingle();
        if (claimError) return NextResponse.json({ error: 'לא ניתן לנעול את בקשת האישור.' }, { status: 500 });
        const pending = claimed as ClaimedChangeRequest | null;
        if (!pending || new Date(pending.expires_at) <= new Date()) {
            return NextResponse.json({ error: 'האישור אינו תקף או פג תוקפו.' }, { status: 409 });
        }

        let result: Record<string, unknown> | null = null;
        if (pending.operation === 'create') {
            const changes = pending.proposed_changes as Record<string, unknown>;
            const { data, error } = await supabaseServer.from('activities').insert({ ...changes, title: changes.title_he, description: changes.description_he ?? null, publication_status: 'approved', is_active: true, approved_at: new Date().toISOString(), approved_by: actorId(auth.profile.id) }).select('*').single();
            if (error) {
                await supabaseServer.from('activity_change_requests').update({ status: 'failed' }).eq('id', pending.id);
                return NextResponse.json({ error: 'לא ניתן ליצור את החוג.' }, { status: 500 });
            }
            result = data;
        } else {
            const { data: current } = await supabaseServer.from('activities').select('*').eq('id', pending.activity_id).maybeSingle();
            if (!current || current.updated_at !== pending.expected_updated_at) {
                await supabaseServer.from('activity_change_requests').update({ status: 'stale' }).eq('id', pending.id);
                await supabaseServer.from('activity_change_requests').update({ status: 'stale' }).eq('id', pending.id);
                return NextResponse.json({ error: 'החוג השתנה מאז ההצעה. יש ליצור הצעה חדשה.' }, { status: 409 });
            }
            const changes = pending.operation === 'archive'
                ? { is_active: false, publication_status: 'archived', archived_at: new Date().toISOString() }
                : pending.proposed_changes;
            const { data, error } = await supabaseServer.from('activities').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', pending.activity_id).eq('updated_at', pending.expected_updated_at).select('*').maybeSingle();
            if (error || !data) {
                await supabaseServer.from('activity_change_requests').update({ status: error ? 'failed' : 'stale' }).eq('id', pending.id);
                return NextResponse.json({ error: 'הפעולה נכשלה או שהחוג השתנה.' }, { status: 409 });
            }
            result = data;
        }
        await supabaseServer.from('activity_change_requests').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', pending.id);
        void invalidateChatCache();
        void writeAuditLog({ actor: auth.profile, action: `assistant.activity.${pending.operation}`, resourceType: 'activity', resourceId: String(result?.id ?? pending.activity_id), metadata: { before: pending.before_snapshot, after: result }, request });
        return NextResponse.json({ response: 'הפעולה אושרה ובוצעה בהצלחה.', result });
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) return NextResponse.json({ error: 'נא לכתוב בקשה.' }, { status: 400 });
    const command = await parseAdminCommand(message);
    if (command.operation === 'query') {
        try {
            return NextResponse.json(await getChatResponse(command.query || message));
        } catch (error) {
            if (error instanceof DataSourceUnavailableError) {
                return NextResponse.json({ responseType: 'system_error', response: 'מקור המידע אינו זמין כרגע. נסה שוב בעוד כמה רגעים.', intent: 'system_error', resultCount: 0, activityCards: [], eventCards: [] }, { status: 503 });
            }
            throw error;
        }
    }
    const permission = requirePermission(auth.profile, 'content:write');
    if (permission) return permission;
    if (command.confidence < 0.75) return NextResponse.json({ responseType: 'clarification', response: 'לא זיהיתי בוודאות את החוג או את השינוי. נא לציין שם חוג מדויק וערך חדש.' });

    let target = null;
    if (command.operation !== 'create') {
        if (!command.target_name) return NextResponse.json({ responseType: 'clarification', response: 'איזה חוג ברצונך לשנות?' });
        let matches;
        try {
            matches = await getActivitiesByName(command.target_name);
        } catch (error) {
            if (error instanceof DataSourceUnavailableError) return NextResponse.json({ error: 'מקור המידע אינו זמין כרגע.' }, { status: 503 });
            throw error;
        }
        if (matches.length !== 1) return NextResponse.json({ responseType: 'clarification', response: matches.length ? 'נמצאו כמה חוגים מתאימים. נא לבחור שם מדויק יותר.' : 'לא נמצא חוג בשם הזה.', activityCards: matches });
        target = matches[0];
    } else if (!command.changes.title_he) {
        return NextResponse.json({ responseType: 'clarification', response: 'כדי ליצור חוג חדש יש לציין לפחות שם חוג.' });
    }

    const nonce = crypto.randomBytes(32).toString('base64url');
    const { error } = await supabaseServer.from('activity_change_requests').insert({
        actor_user_id: actorId(auth.profile.id), actor_email: auth.profile.email, operation: command.operation,
        activity_id: target?.id ?? null, before_snapshot: target, proposed_changes: command.changes,
        expected_updated_at: target ? (target as unknown as { updated_at: string }).updated_at : null,
        nonce_hash: hashNonce(nonce), expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) return NextResponse.json({ error: 'לא ניתן ליצור בקשת אישור.' }, { status: 500 });
    void writeAuditLog({ actor: auth.profile, action: 'assistant.change.proposed', resourceType: 'activity', resourceId: target?.id, metadata: { operation: command.operation, changes: command.changes }, request });
    return NextResponse.json({ responseType: 'confirmation', response: 'הפעולה טרם בוצעה. בדוק את הפרטים ואשר במפורש.', target, operation: command.operation, changes: command.changes, token: nonce, expiresInSeconds: 600 });
}
