import crypto from 'node:crypto';

import { invalidateChatCache } from '@/lib/ai/chat-cache';
import { writeAuditLog } from '@/lib/observability/audit';
import { supabaseServer } from '@/lib/supabase/server';
import type { AdminProfile } from './auth';
import { activitySchema } from './schemas';

export type ActivityChangeOperation = 'create' | 'update' | 'archive';

type ClaimedChangeRequest = {
    id: string;
    expires_at: string;
    operation: ActivityChangeOperation;
    activity_id: string | null;
    proposed_changes: Record<string, unknown>;
    expected_updated_at: string | null;
    before_snapshot: Record<string, unknown> | null;
};

export class ActivityChangeError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = 'ActivityChangeError';
    }
}

function actorId(value: string) {
    return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function hashNonce(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
type ScheduleChange = { day_of_week: number; start_time: string | null; end_time: string | null };

function splitSchedules(changes: Record<string, unknown>) {
    const { schedules: rawSchedules, ...activityChanges } = changes;
    const schedules = Array.isArray(rawSchedules) ? rawSchedules as ScheduleChange[] : undefined;
    if (schedules?.length) {
        activityChanges.days_of_week = [...new Set(schedules.map((item) => DAY_NAMES[item.day_of_week]))].join(',');
        activityChanges.start_time = schedules[0].start_time;
        activityChanges.end_time = schedules[0].end_time;
    }
    return { activityChanges, schedules };
}

async function replaceSchedules(activityId: string, schedules?: ScheduleChange[]) {
    if (!schedules) return;
    const { error: deleteError } = await supabaseServer.from('activity_schedules').delete().eq('activity_id', activityId);
    if (deleteError) throw deleteError;
    if (schedules.length === 0) return;
    const { error } = await supabaseServer.from('activity_schedules').insert(
        schedules.map((schedule) => ({ activity_id: activityId, ...schedule })),
    );
    if (error) throw error;
}

async function ensureBranchId(location: unknown) {
    if (typeof location !== 'string' || !location.trim()) return null;
    const name = location.trim().replace(/\s+/g, ' ');
    const { data: existing, error: readError } = await supabaseServer.from('branches')
        .select('id').ilike('name', name).limit(1).maybeSingle();
    if (readError) throw readError;
    if (existing) return existing.id;
    const { data, error } = await supabaseServer.from('branches').insert({ name }).select('id').single();
    if (!error) return data.id;
    const { data: concurrent } = await supabaseServer.from('branches').select('id').ilike('name', name).limit(1).maybeSingle();
    if (concurrent) return concurrent.id;
    throw error;
}

function validateChanges(operation: ActivityChangeOperation, input: unknown) {
    if (operation === 'archive') return {};
    const schema = operation === 'create'
        ? activitySchema.partial().required({ title_he: true })
        : activitySchema.partial();
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new ActivityChangeError('פרטי השינוי אינם תקינים.', 400);
    if (operation === 'update' && Object.keys(parsed.data).length === 0) {
        throw new ActivityChangeError('לא נשלחו שדות לעדכון.', 400);
    }
    return parsed.data as Record<string, unknown>;
}

function validateMergedActivity(target: Record<string, unknown> | null, changes: Record<string, unknown>) {
    const value = (field: string) => field in changes ? changes[field] : target?.[field];
    const minAge = value('min_age') as number | null | undefined;
    const maxAge = value('max_age') as number | null | undefined;
    const minGrade = value('min_grade') as number | null | undefined;
    const maxGrade = value('max_grade') as number | null | undefined;
    const currentParticipants = Number(value('current_participants') ?? 0);
    const maxParticipants = value('max_participants') as number | null | undefined;
    if (minAge != null && maxAge != null && minAge > maxAge) throw new ActivityChangeError('טווח הגילים אינו תקין.', 400);
    if (minGrade != null && maxGrade != null && minGrade > maxGrade) throw new ActivityChangeError('טווח הכיתות אינו תקין.', 400);
    if (maxParticipants != null && maxParticipants < currentParticipants) throw new ActivityChangeError('המכסה החדשה נמוכה ממספר הנרשמים הקיים.', 400);
}

export async function proposeActivityChange(args: {
    profile: AdminProfile;
    operation: ActivityChangeOperation;
    activityId?: string | null;
    changes?: unknown;
    expectedUpdatedAt?: string | null;
    request?: Request;
    channel?: 'web' | 'whatsapp';
}) {
    const changes = validateChanges(args.operation, args.changes ?? {});
    let target: Record<string, unknown> | null = null;

    if (args.operation !== 'create') {
        if (!args.activityId) throw new ActivityChangeError('לא נבחר חוג לשינוי.', 400);
        const { data, error } = await supabaseServer
            .from('activities')
            .select('*, categories(id,name_he), branches(id,name)')
            .eq('id', args.activityId)
            .maybeSingle();
        if (error) throw new ActivityChangeError('לא ניתן לקרוא את החוג.', 500);
        if (!data) throw new ActivityChangeError('החוג לא נמצא.', 404);
        target = data as Record<string, unknown>;
        if (args.expectedUpdatedAt && data.updated_at !== args.expectedUpdatedAt) {
            throw new ActivityChangeError('החוג השתנה מאז שנפתח. נא לרענן ולנסות שוב.', 409);
        }
    }
    validateMergedActivity(target, changes);

    const nonce = args.channel === 'whatsapp'
        ? String(crypto.randomInt(100000, 1000000))
        : crypto.randomBytes(32).toString('base64url');
    const { error } = await supabaseServer.from('activity_change_requests').insert({
        actor_user_id: actorId(args.profile.id),
        actor_email: args.profile.email,
        operation: args.operation,
        activity_id: args.activityId ?? null,
        before_snapshot: target,
        proposed_changes: changes,
        expected_updated_at: target ? String(target.updated_at) : null,
        nonce_hash: hashNonce(nonce),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw new ActivityChangeError('לא ניתן ליצור בקשת אישור.', 500);

    void writeAuditLog({
        actor: args.profile,
        action: 'activity.change.proposed',
        resourceType: 'activity',
        resourceId: args.activityId ?? undefined,
        metadata: { operation: args.operation, changes },
        request: args.request,
    });

    return {
        responseType: 'confirmation' as const,
        response: 'הפעולה טרם בוצעה. בדקו את הפרטים ואשרו במפורש.',
        target,
        operation: args.operation,
        changes,
        token: nonce,
        expiresInSeconds: 600,
    };
}

export async function confirmActivityChange(args: {
    profile: AdminProfile;
    token: string;
    request?: Request;
}) {
    if (!args.token) throw new ActivityChangeError('חסר אסימון אישור.', 400);
    const { data: claimed, error: claimError } = await supabaseServer.rpc('claim_activity_change_request', {
        p_nonce_hash: hashNonce(args.token),
        p_actor_email: args.profile.email,
    }).maybeSingle();
    if (claimError) throw new ActivityChangeError('לא ניתן לנעול את בקשת האישור.', 500);
    const pending = claimed as ClaimedChangeRequest | null;
    if (!pending || new Date(pending.expires_at) <= new Date()) {
        throw new ActivityChangeError('האישור אינו תקף, כבר נוצל או פג תוקפו.', 409);
    }

    let result: Record<string, unknown> | null = null;
    try {
        if (pending.operation === 'create') {
            const changes = validateChanges('create', pending.proposed_changes);
            const { activityChanges, schedules } = splitSchedules(changes);
            if (!activityChanges.branch_id && 'location' in activityChanges) activityChanges.branch_id = await ensureBranchId(activityChanges.location);
            const { data, error } = await supabaseServer.from('activities').insert({
                ...activityChanges,
                title: activityChanges.title_he,
                description: activityChanges.description_he ?? null,
                publication_status: 'approved',
                is_active: true,
                approved_at: new Date().toISOString(),
                approved_by: actorId(args.profile.id),
            }).select('*').single();
            if (error) throw error;
            await replaceSchedules(data.id, schedules);
            result = data;
        } else {
            const { data: current, error: readError } = await supabaseServer
                .from('activities').select('*').eq('id', pending.activity_id).maybeSingle();
            if (readError) throw readError;
            if (!current || current.updated_at !== pending.expected_updated_at) {
                await supabaseServer.from('activity_change_requests').update({ status: 'stale' }).eq('id', pending.id);
                throw new ActivityChangeError('החוג השתנה מאז ההצעה. יש ליצור הצעה חדשה.', 409);
            }
            const changes = pending.operation === 'archive'
                ? { is_active: false, publication_status: 'archived', archived_at: new Date().toISOString() }
                : validateChanges('update', pending.proposed_changes);
            const { activityChanges, schedules } = splitSchedules(changes);
            if (!activityChanges.branch_id && 'location' in activityChanges) activityChanges.branch_id = await ensureBranchId(activityChanges.location);
            const mirrored = {
                ...activityChanges,
                ...('title_he' in activityChanges ? { title: activityChanges.title_he } : {}),
                ...('description_he' in activityChanges ? { description: activityChanges.description_he } : {}),
                updated_at: new Date().toISOString(),
            };
            const { data, error } = await supabaseServer.from('activities')
                .update(mirrored)
                .eq('id', pending.activity_id)
                .eq('updated_at', pending.expected_updated_at)
                .select('*').maybeSingle();
            if (error || !data) throw new ActivityChangeError('הפעולה נכשלה או שהחוג השתנה.', 409);
            await replaceSchedules(data.id, schedules);
            result = data;
        }
    } catch (error) {
        if (!(error instanceof ActivityChangeError && error.status === 409)) {
            await supabaseServer.from('activity_change_requests').update({ status: 'failed' }).eq('id', pending.id);
        }
        if (error instanceof ActivityChangeError) throw error;
        throw new ActivityChangeError('לא ניתן לבצע את השינוי.', 500);
    }

    await supabaseServer.from('activity_change_requests')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', pending.id);
    void invalidateChatCache();
    void writeAuditLog({
        actor: args.profile,
        action: `activity.${pending.operation}.confirmed`,
        resourceType: 'activity',
        resourceId: String(result?.id ?? pending.activity_id),
        metadata: { before: pending.before_snapshot, after: result },
        request: args.request,
    });
    return { response: 'הפעולה אושרה ובוצעה בהצלחה.', result };
}
