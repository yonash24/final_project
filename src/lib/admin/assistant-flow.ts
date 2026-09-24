/**
 * assistant-flow.ts
 * Pure control flow for the natural-language admin assistant, shared by
 * the web API route. The LLM (via `parseCommand`) only ever returns a
 * structured, whitelisted `AdminCommand` — this module is the ordinary
 * software layer that checks the target exists, is unambiguous, and that
 * the actor is authorized before ever proposing a change; it never
 * executes a write itself (that still requires a separate explicit
 * confirmation call against `proposeActivityChange`'s token).
 */

import type { ActivitySelector, AdminCommand } from './admin-command-schema.ts';
import { activitySelectorSchema } from './admin-command-schema.ts';
import type { AdminProfile } from './auth.ts';
import type { ActivityChangeOperation } from './activity-change-types.ts';
import { OPERATION_PERMISSION } from './activity-change-types.ts';
import type { ActivityRow } from '../db/chat-queries.ts';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY_SELECTOR: ActivitySelector = activitySelectorSchema.parse({});

export interface ProposalResult {
    responseType: 'confirmation';
    response: string;
    target: Record<string, unknown> | null;
    operation: string;
    changes: Record<string, unknown>;
    token: string;
    requestId: string;
    riskLevel: string;
    approvalMethod: string;
    expiresInSeconds: number;
}

export interface PendingChangeRow {
    id: string;
    operation: string;
    activity_id: string | null;
    proposed_changes: Record<string, unknown>;
    before_snapshot: Record<string, unknown> | null;
    approval_method: string;
    expires_at: string;
}

export interface AssistantDeps {
    parseCommand(message: string): Promise<AdminCommand>;
    resolveSelector(selector: ActivitySelector, status: 'active' | 'draft' | 'archived' | 'all'): Promise<ActivityRow[]>;
    propose(args: {
        profile: AdminProfile;
        operation: ActivityChangeOperation;
        activityId?: string | null;
        changes?: unknown;
        request?: Request;
    }): Promise<ProposalResult>;
    cancel(args: { profile: AdminProfile; requestId: string; request?: Request }): Promise<{ response: string; requestId: string }>;
    listPending(profile: AdminProfile): Promise<PendingChangeRow[]>;
    hasPermission(profile: AdminProfile, permission: string): boolean;
}

export interface AssistantInput {
    message: string;
    selectedActivityId?: string | null;
    profile: AdminProfile;
    request?: Request;
}

export interface AssistantResult {
    status: number;
    body: Record<string, unknown>;
}

const FIELD_LABELS: Record<string, string> = {
    title_he: 'שם', location: 'סניף', venue: 'מיקום', group_name: 'קבוצה', days_of_week: 'יום',
    start_time: 'שעת התחלה', end_time: 'שעת סיום', price: 'מחיר', instructor_name: 'מדריך',
    min_age: 'גיל מינימלי', max_age: 'גיל מקסימלי', target_age_group: 'קהל יעד', max_participants: 'מכסה',
};
const OPERATION_LABELS: Record<string, string> = {
    create_draft: 'יצירת טיוטה', update: 'עדכון', archive: 'ארכוב', restore: 'שחזור', publish: 'פרסום',
};

/**
 * Renders a before -> after summary of a proposed change. Shared by the
 * web assistant and the WhatsApp admin flow so a confirmation always
 * shows exactly what is about to change, per the "no guessing, always
 * show what will change" safety rule.
 */
export function describeActivityChange(proposal: { target: Record<string, unknown> | null; changes: Record<string, unknown>; operation: string }): string {
    const target = proposal.target ?? {};
    const title = String(target.title_he ?? proposal.changes.title_he ?? 'חוג חדש');
    const details = Object.entries(proposal.changes).map(([field, next]) => {
        const previous = field in target ? target[field] : 'לא הוגדר';
        return `${FIELD_LABELS[field] ?? field}: ${String(previous ?? 'לא הוגדר')} ← ${String(next ?? 'ריק')}`;
    });
    return [
        'הפעולה עדיין לא בוצעה.', '',
        `פעולה: ${OPERATION_LABELS[proposal.operation] ?? proposal.operation}`,
        `חוג: ${title}`,
        target.location ? `סניף: ${String(target.location)}` : null,
        target.group_name ? `קבוצה: ${String(target.group_name)}` : null,
        target.days_of_week ? `יום: ${String(target.days_of_week)}` : null,
        details.length ? `\n${details.join('\n')}` : null,
    ].filter((value): value is string => value != null).join('\n');
}

function describePendingChange(row: PendingChangeRow) {
    return {
        id: row.id,
        operation: row.operation,
        title: row.before_snapshot?.title_he ?? row.proposed_changes?.title_he ?? null,
        expires_at: row.expires_at,
        approval_method: row.approval_method,
    };
}

function denied(): AssistantResult {
    return { status: 403, body: { error: 'אין הרשאה לבצע את הפעולה.' } };
}

function clarification(response: string, extra: Record<string, unknown> = {}): AssistantResult {
    return { status: 200, body: { responseType: 'clarification', response, ...extra } };
}

function selectorFromCommand(command: AdminCommand): ActivitySelector {
    return { ...command.target_selector, name: command.target_selector.name ?? command.target_name };
}

function isSelectorEmpty(selector: ActivitySelector): boolean {
    return !Object.values(selector).some((value) => value != null && value !== '');
}

function statusForOperation(operation: ActivityChangeOperation): 'active' | 'draft' | 'archived' {
    if (operation === 'restore') return 'archived';
    if (operation === 'publish') return 'draft';
    return 'active';
}

export async function runAdminAssistant(input: AssistantInput, deps: AssistantDeps): Promise<AssistantResult> {
    let command: AdminCommand;
    try {
        command = await deps.parseCommand(input.message);
    } catch (error) {
        console.error('[AdminAssistant] parseCommand failed:', error instanceof Error ? error.stack ?? error.message : error);
        return {
            status: 503,
            body: { responseType: 'system_error', response: 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד רגע.' },
        };
    }

    const selectedId = input.selectedActivityId && UUID_RE.test(input.selectedActivityId) ? input.selectedActivityId : null;
    const selector: ActivitySelector = selectedId ? { ...EMPTY_SELECTOR, activity_id: selectedId } : selectorFromCommand(command);
    const confident = selectedId != null || command.confidence >= 0.75;

    if (command.operation === 'query') {
        if (!deps.hasPermission(input.profile, 'activity:read')) return denied();
        const matches = await deps.resolveSelector(selector, 'all');
        return {
            status: 200,
            body: {
                responseType: 'results',
                response: matches.length ? `נמצאו ${matches.length} חוגים, כולל טיוטות ופריטים בארכיון בהתאם להרשאת הניהול.` : 'לא נמצאו חוגים מתאימים.',
                intent: 'admin_activity_query', resultCount: matches.length, activityCards: matches, eventCards: [],
            },
        };
    }

    if (command.operation === 'list_pending') {
        const rows = await deps.listPending(input.profile);
        return {
            status: 200,
            body: {
                responseType: 'answer',
                response: rows.length ? `יש ${rows.length} פעולות ממתינות לאישור.` : 'אין פעולות ממתינות.',
                pendingChanges: rows.map(describePendingChange),
            },
        };
    }

    if (command.operation === 'cancel') {
        const rows = await deps.listPending(input.profile);
        if (rows.length === 0) {
            return { status: 200, body: { responseType: 'answer', response: 'אין פעולות ממתינות לביטול.' } };
        }
        if (rows.length > 1) {
            return clarification('נמצאו כמה פעולות ממתינות. איזו מהן לבטל?', { pendingChanges: rows.map(describePendingChange) });
        }
        const cancelled = await deps.cancel({ profile: input.profile, requestId: rows[0].id, request: input.request });
        return { status: 200, body: { responseType: 'answer', response: cancelled.response } };
    }

    // Write operations from here on: create_draft, update, archive, restore, publish.
    const operation = command.operation as ActivityChangeOperation;
    if (!deps.hasPermission(input.profile, OPERATION_PERMISSION[operation])) return denied();

    if (operation === 'create_draft') {
        if (!command.changes.title_he) return clarification('כדי ליצור חוג חדש יש לציין לפחות שם חוג.');
        if (!confident) return clarification('לא זיהיתי בוודאות את פרטי החוג החדש. אפשר לפרט שוב עם שם חוג ברור?');
        const proposal = await deps.propose({ profile: input.profile, operation, changes: command.changes, request: input.request });
        return { status: 200, body: { ...proposal, summary: describeActivityChange(proposal) } };
    }

    if (isSelectorEmpty(selector)) {
        return clarification('איזה חוג ברצונך לשנות? אפשר לציין שם, סניף, יום ושעה.');
    }

    const matches = await deps.resolveSelector(selector, statusForOperation(operation));
    if (matches.length === 0) {
        return clarification('לא נמצא חוג שמתאים לכל התנאים שצוינו. לא בוצע שינוי.');
    }
    if (matches.length > 1) {
        return clarification('נמצאו כמה חוגים מתאימים. בחרו את החוג המדויק לפי הסניף, היום והשעה.', {
            activityCards: matches, selectionRequired: true,
        });
    }
    if (!confident) {
        return clarification('לא זיהיתי בוודאות. האם הכוונה לחוג הזה?', { activityCards: matches, selectionRequired: true });
    }

    const proposal = await deps.propose({
        profile: input.profile, operation, activityId: matches[0].id, changes: command.changes, request: input.request,
    });
    return { status: 200, body: { ...proposal, summary: describeActivityChange(proposal) } };
}
