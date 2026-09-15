import crypto from 'node:crypto';

import { invalidateChatCache } from '@/lib/ai/chat-cache';
import { buildActivityEmbeddingText, generateEmbedding } from '@/lib/ai/embeddings';
import { writeAuditLog } from '@/lib/observability/audit';
import { supabaseServer } from '@/lib/supabase/server';
import { hasPermission, type AdminProfile } from './auth';
import { activitySchema } from './schemas';

export type ActivityChangeOperation = 'create_draft' | 'update' | 'archive' | 'restore' | 'publish';
export type ActivityChangeApprovalMethod = 'web_token' | 'whatsapp_code' | 'web_mfa';

export const OPERATION_PERMISSION: Record<ActivityChangeOperation, string> = {
    create_draft: 'activity:create',
    update: 'activity:update',
    archive: 'activity:archive',
    restore: 'activity:restore',
    publish: 'activity:publish',
};

type ClaimedChangeRequest = {
    id: string;
    expires_at: string;
    operation: ActivityChangeOperation;
    activity_id: string | null;
    proposed_changes: Record<string, unknown>;
    expected_updated_at: string | null;
    before_snapshot: Record<string, unknown> | null;
    channel_identity_id: string | null;
    approval_method: ActivityChangeApprovalMethod;
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

async function refreshActivityEmbedding(activityId: string) {
    const { data, error } = await supabaseServer.from('activities')
        .select('id,title_he,description_he,target_age_group,days_of_week,location,instructor_name,is_active,publication_status,categories(name_he)')
        .eq('id', activityId).maybeSingle();
    if (error || !data) return;
    if (!data.is_active || data.publication_status !== 'approved') {
        await supabaseServer.from('activities').update({ embedding: null }).eq('id', activityId);
        return;
    }
    const category = data.categories as unknown as { name_he?: string } | Array<{ name_he?: string }> | null;
    const categoryName = Array.isArray(category) ? category[0]?.name_he : category?.name_he;
    const embedding = await generateEmbedding(buildActivityEmbeddingText({ ...data, category_name_he: categoryName ?? null }));
    await supabaseServer.from('activities').update({ embedding }).eq('id', activityId);
}

function refreshDerivedActivityData(result: Record<string, unknown> | null) {
    void invalidateChatCache();
    if (typeof result?.id === 'string') void refreshActivityEmbedding(result.id).catch(() => undefined);
}

function validateChanges(operation: ActivityChangeOperation, input: unknown) {
    if (operation === 'archive' || operation === 'restore' || operation === 'publish') return {};
    const schema = operation === 'create_draft'
        ? activitySchema.partial().required({ title_he: true })
        : activitySchema.partial();
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new ActivityChangeError('פרטי השינוי אינם תקינים.', 400);
    const { is_active: _isActive, current_participants: _currentParticipants, ...safeChanges } = parsed.data;
    void _isActive;
    void _currentParticipants;
    if (operation === 'update' && Object.keys(safeChanges).length === 0) {
        throw new ActivityChangeError('לא נשלחו שדות לעדכון.', 400);
    }
    return safeChanges as Record<string, unknown>;
}

function validateMergedActivity(target: Record<string, unknown> | null, changes: Record<string, unknown>) {
    const value = (field: string) => field in changes ? changes[field] : target?.[field];
    const minAge = value('min_age') as number | null | undefined;
    const maxAge = value('max_age') as number | null | undefined;
    const minGrade = value('min_grade') as number | null | undefined;
    const maxGrade = value('max_grade') as number | null | undefined;
    const currentParticipants = Number(value('current_participants') ?? 0);
    const maxParticipants = value('max_participants') as number | null | undefined;
    const startTime = value('start_time') as string | null | undefined;
    const endTime = value('end_time') as string | null | undefined;
    if (minAge != null && maxAge != null && minAge > maxAge) throw new ActivityChangeError('טווח הגילים אינו תקין.', 400);
    if (minGrade != null && maxGrade != null && minGrade > maxGrade) throw new ActivityChangeError('טווח הכיתות אינו תקין.', 400);
    if (maxParticipants != null && maxParticipants < currentParticipants) throw new ActivityChangeError('המכסה החדשה נמוכה ממספר הנרשמים הקיים.', 400);
    if (startTime && endTime && startTime >= endTime) throw new ActivityChangeError('שעת הסיום חייבת להיות אחרי שעת ההתחלה.', 400);
}

export async function proposeActivityChange(args: {
    profile: AdminProfile;
    operation: ActivityChangeOperation;
    activityId?: string | null;
    changes?: unknown;
    expectedUpdatedAt?: string | null;
    request?: Request;
    channel?: 'web' | 'whatsapp';
    channelIdentityId?: string | null;
    conversationId?: string | null;
    sourceMessageId?: string | null;
}) {
    if (!hasPermission(args.profile, OPERATION_PERMISSION[args.operation])) {
        throw new ActivityChangeError('אין הרשאה לבצע את הפעולה.', 403);
    }
    const changes = validateChanges(args.operation, args.changes ?? {});
    let target: Record<string, unknown> | null = null;

    if (args.operation !== 'create_draft') {
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

    if (args.channel === 'whatsapp' && !args.channelIdentityId) {
        throw new ActivityChangeError('זהות WhatsApp מאומתת נדרשת לפעולת ניהול.', 403);
    }
    const riskLevel = ['archive', 'restore', 'publish'].includes(args.operation) ? 'high' : 'medium';
    const approvalMethod: ActivityChangeApprovalMethod = riskLevel === 'high'
        ? 'web_mfa'
        : args.channel === 'whatsapp' ? 'whatsapp_code' : 'web_token';
    const nonce = approvalMethod === 'whatsapp_code'
        ? String(crypto.randomInt(100000, 1000000))
        : crypto.randomBytes(32).toString('base64url');
    if (args.channelIdentityId) {
        const { count, error: pendingError } = await supabaseServer.from('activity_change_requests')
            .select('id', { count: 'exact', head: true })
            .eq('channel_identity_id', args.channelIdentityId).eq('status', 'pending').gt('expires_at', new Date().toISOString());
        if (pendingError) throw new ActivityChangeError('לא ניתן לבדוק פעולות ממתינות.', 500);
        if ((count ?? 0) >= 3) throw new ActivityChangeError('קיימות כבר שלוש פעולות ממתינות. יש לאשר או לבטל אחת מהן.', 429);
    }
    const { data: inserted, error } = await supabaseServer.from('activity_change_requests').insert({
        actor_user_id: actorId(args.profile.id),
        actor_email: args.profile.email,
        operation: args.operation,
        activity_id: args.activityId ?? null,
        before_snapshot: target,
        proposed_changes: changes,
        expected_updated_at: target ? String(target.updated_at) : null,
        nonce_hash: hashNonce(nonce),
        expires_at: new Date(Date.now() + (riskLevel === 'high' ? 30 : 10) * 60_000).toISOString(),
        channel_identity_id: args.channelIdentityId ?? null,
        conversation_id: args.conversationId ?? null,
        source_message_id: args.sourceMessageId ?? null,
        risk_level: riskLevel,
        approval_method: approvalMethod,
    }).select('id').single();
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
        requestId: inserted.id,
        riskLevel,
        approvalMethod,
        expiresInSeconds: riskLevel === 'high' ? 1800 : 600,
    };
}

export async function autoExecuteActivityChange(args: {
    profile: AdminProfile;
    operation: 'create_draft' | 'update';
    activityId?: string | null;
    changes?: unknown;
    expectedUpdatedAt?: string | null;
    request?: Request;
}) {
    const proposal = await proposeActivityChange({ ...args, channel: 'web' });
    return confirmActivityChange({ profile: args.profile, token: proposal.token, request: args.request });
}

export async function confirmActivityChange(args: {
    profile: AdminProfile;
    token: string;
    request?: Request;
    channelIdentityId?: string | null;
}) {
    if (!args.token) throw new ActivityChangeError('חסר אסימון אישור.', 400);
    const approvalMethod: ActivityChangeApprovalMethod = args.channelIdentityId ? 'whatsapp_code' : 'web_token';
    if (args.channelIdentityId) {
        const { data: identity } = await supabaseServer.from('admin_channel_identities')
            .select('confirmation_locked_until').eq('id', args.channelIdentityId).maybeSingle();
        if (identity?.confirmation_locked_until && new Date(identity.confirmation_locked_until) > new Date()) {
            throw new ActivityChangeError('האישורים נעולים זמנית לאחר ניסיונות שגויים. נסו שוב מאוחר יותר.', 429);
        }
    }
    const { data: pending, error: readError } = await supabaseServer.from('activity_change_requests')
        .select('id,operation,activity_id,before_snapshot,proposed_changes,channel_identity_id,approval_method,expires_at')
        .eq('nonce_hash', hashNonce(args.token)).eq('actor_email', args.profile.email).eq('status', 'pending').maybeSingle();
    if (readError) throw new ActivityChangeError('לא ניתן לקרוא את בקשת האישור.', 500);
    const typedPending = pending as ClaimedChangeRequest | null;
    if (!typedPending || typedPending.approval_method !== approvalMethod || (args.channelIdentityId && typedPending.channel_identity_id !== args.channelIdentityId)) {
        if (args.channelIdentityId) await supabaseServer.rpc('register_admin_confirmation_failure', { p_identity_id: args.channelIdentityId });
        void writeAuditLog({ actor: args.profile, action: 'activity.change.confirmation_rejected', resourceType: 'activity_change_request', metadata: { approvalMethod } });
        throw new ActivityChangeError('האישור אינו תקף לערוץ או למנהל הזה.', 409);
    }
    if (!hasPermission(args.profile, OPERATION_PERMISSION[typedPending.operation])) {
        throw new ActivityChangeError('ההרשאה לביצוע הפעולה אינה קיימת עוד.', 403);
    }
    if (!hasPermission(args.profile, OPERATION_PERMISSION[typedPending.operation])) {
        throw new ActivityChangeError('ההרשאה לפעולה אינה קיימת עוד.', 403);
    }
    const { data, error } = await supabaseServer.rpc('execute_activity_change', {
        p_request_id: typedPending.id,
        p_actor_email: args.profile.email,
        p_channel_identity_id: args.channelIdentityId ?? null,
        p_nonce_hash: hashNonce(args.token),
        p_approval_method: approvalMethod,
    });
    if (error) {
        void writeAuditLog({ actor: args.profile, action: 'activity.change.failed', resourceType: 'activity_change_request', resourceId: typedPending.id, metadata: { operation: typedPending.operation, approvalMethod } });
        throw new ActivityChangeError(mapExecutionError(error.message), 409);
    }
    const execution = data as { error?: string; result?: Record<string, unknown>; requestId?: string } | null;
    if (execution?.error) {
        void writeAuditLog({ actor: args.profile, action: 'activity.change.failed', resourceType: 'activity_change_request', resourceId: typedPending.id, metadata: { operation: typedPending.operation, approvalMethod } });
        throw new ActivityChangeError(mapExecutionError(execution.error), 409);
    }
    if (args.channelIdentityId) {
        await supabaseServer.from('admin_channel_identities').update({ confirmation_failures: 0, confirmation_locked_until: null }).eq('id', args.channelIdentityId);
    }
    const result = execution?.result ?? null;
    refreshDerivedActivityData(result);
    void writeAuditLog({
        actor: args.profile,
        action: `activity.${typedPending.operation}.confirmed`,
        resourceType: 'activity',
        resourceId: String(result?.id ?? typedPending.activity_id),
        metadata: { before: typedPending.before_snapshot, after: result, approvalMethod },
        request: args.request,
    });
    return { response: successfulExecutionResponse(typedPending.operation, result), result, operation: typedPending.operation, requestId: typedPending.id };
}

function mapExecutionError(message: string) {
    if (message.includes('activity_changed')) return 'החוג השתנה מאז ההצעה. יש ליצור הצעה חדשה.';
    if (message.includes('activity_incomplete_for_publish')) return 'לא ניתן לפרסם: חסרים סניף, לוח זמנים מלא או קהל יעד.';
    if (message.includes('activity_not_found')) return 'החוג לא נמצא.';
    return 'האישור אינו תקף, כבר נוצל, פג תוקפו או שהפעולה נכשלה.';
}

function successfulExecutionResponse(operation: ActivityChangeOperation, result: Record<string, unknown> | null) {
    const labels: Record<ActivityChangeOperation, string> = {
        create_draft: 'הטיוטה נוצרה', update: 'החוג עודכן', archive: 'החוג הועבר לארכיון',
        restore: 'החוג שוחזר כטיוטה', publish: 'החוג פורסם',
    };
    const title = String(result?.title_he ?? result?.title ?? 'החוג');
    return `${labels[operation]} בהצלחה: ${title}.`;
}

export async function confirmHighRiskActivityChange(args: {
    profile: AdminProfile;
    requestId: string;
    request?: Request;
}) {
    const { data: pending, error: readError } = await supabaseServer.from('activity_change_requests')
        .select('id,operation,activity_id,before_snapshot,approval_method')
        .eq('id', args.requestId).eq('actor_email', args.profile.email).eq('status', 'pending').maybeSingle();
    if (readError) throw new ActivityChangeError('לא ניתן לקרוא את בקשת האישור.', 500);
    if (!pending || pending.approval_method !== 'web_mfa') {
        throw new ActivityChangeError('בקשת האישור אינה זמינה או אינה דורשת אישור מוגבר.', 409);
    }
    const operation = pending.operation as ActivityChangeOperation;
    if (!hasPermission(args.profile, OPERATION_PERMISSION[operation])) {
        throw new ActivityChangeError('ההרשאה לביצוע הפעולה אינה קיימת עוד.', 403);
    }
    if (!hasPermission(args.profile, OPERATION_PERMISSION[pending.operation as ActivityChangeOperation])) {
        throw new ActivityChangeError('ההרשאה לפעולה אינה קיימת עוד.', 403);
    }
    const { data, error } = await supabaseServer.rpc('execute_activity_change', {
        p_request_id: pending.id,
        p_actor_email: args.profile.email,
        p_channel_identity_id: null,
        p_nonce_hash: null,
        p_approval_method: 'web_mfa',
    });
    if (error) {
        void writeAuditLog({ actor: args.profile, action: 'activity.change.failed', resourceType: 'activity_change_request', resourceId: pending.id, metadata: { operation: pending.operation, approvalMethod: 'web_mfa' } });
        throw new ActivityChangeError(mapExecutionError(error.message), 409);
    }
    const execution = data as { error?: string; result?: Record<string, unknown>; requestId?: string } | null;
    if (execution?.error) {
        void writeAuditLog({ actor: args.profile, action: 'activity.change.failed', resourceType: 'activity_change_request', resourceId: pending.id, metadata: { operation: pending.operation, approvalMethod: 'web_mfa' } });
        throw new ActivityChangeError(mapExecutionError(execution.error), 409);
    }
    const result = execution?.result ?? null;
    refreshDerivedActivityData(result);
    void writeAuditLog({
        actor: args.profile,
        action: `activity.${pending.operation}.confirmed`,
        resourceType: 'activity',
        resourceId: String(result?.id ?? pending.activity_id),
        metadata: { before: pending.before_snapshot, after: result, approvalMethod: 'web_mfa' },
        request: args.request,
    });
    return { response: successfulExecutionResponse(operation, result), result, operation, requestId: pending.id };
}

export async function cancelActivityChange(args: {
    profile: AdminProfile;
    requestId?: string;
    token?: string;
    channelIdentityId?: string | null;
    request?: Request;
}) {
    let query = supabaseServer.from('activity_change_requests').update({
        status: 'cancelled', cancelled_at: new Date().toISOString(),
    }).eq('actor_email', args.profile.email).eq('status', 'pending');
    if (args.requestId) query = query.eq('id', args.requestId);
    else if (args.token) query = query.eq('nonce_hash', hashNonce(args.token));
    else throw new ActivityChangeError('חסר מזהה פעולה לביטול.', 400);
    if (args.channelIdentityId) query = query.eq('channel_identity_id', args.channelIdentityId);
    const { data, error } = await query.select('id,operation').maybeSingle();
    if (error) throw new ActivityChangeError('לא ניתן לבטל את הפעולה.', 500);
    if (!data) throw new ActivityChangeError('הפעולה אינה ממתינה, אינה שייכת למנהל או שפג תוקפה.', 409);
    void writeAuditLog({ actor: args.profile, action: 'activity.change.cancelled', resourceType: 'activity_change_request', resourceId: data.id, metadata: { operation: data.operation }, request: args.request });
    return { response: 'בקשת השינוי בוטלה. לא בוצע שינוי בחוג.', requestId: data.id };
}

export async function listPendingActivityChanges(profile: AdminProfile, channelIdentityId?: string | null) {
    let query = supabaseServer.from('activity_change_requests')
        .select('id,operation,activity_id,proposed_changes,before_snapshot,approval_method,expires_at,created_at')
        .eq('actor_email', profile.email).eq('status', 'pending').gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(3);
    if (channelIdentityId) query = query.eq('channel_identity_id', channelIdentityId);
    const { data, error } = await query;
    if (error) throw new ActivityChangeError('לא ניתן לטעון פעולות ממתינות.', 500);
    return data ?? [];
}
