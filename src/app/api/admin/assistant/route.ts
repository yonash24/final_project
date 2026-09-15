import { NextRequest, NextResponse } from 'next/server';

import { parseAdminCommand } from '@/lib/admin/admin-command';
import { requireAdminRequest, hasPermission } from '@/lib/admin/auth';
import { ActivityChangeError, cancelActivityChange, confirmActivityChange, listPendingActivityChanges, proposeActivityChange } from '@/lib/admin/activity-changes';
import { resolveAdminActivitySelector } from '@/lib/admin/activity-selector';
import { runAdminAssistant, type AssistantDeps } from '@/lib/admin/assistant-flow';
import { DataSourceUnavailableError } from '@/lib/db/data-source';

function buildDeps(): AssistantDeps {
    return {
        parseCommand: parseAdminCommand,
        resolveSelector: resolveAdminActivitySelector,
        propose: (args) => proposeActivityChange({ ...args, channel: 'web' }),
        cancel: (args) => cancelActivityChange({ profile: args.profile, requestId: args.requestId, request: args.request }),
        listPending: (profile) => listPendingActivityChanges(profile),
        hasPermission,
    };
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const body = await request.json();

    if (body.action === 'confirm') {
        const token = typeof body.token === 'string' ? body.token : '';
        try {
            return NextResponse.json(await confirmActivityChange({ profile: auth.profile, token, request }));
        } catch (error) {
            if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
            throw error;
        }
    }

    if (body.action === 'cancel') {
        const requestId = typeof body.requestId === 'string' ? body.requestId : '';
        const token = typeof body.token === 'string' ? body.token : undefined;
        if (!requestId && !token) return NextResponse.json({ error: 'חסר מזהה פעולה לביטול.' }, { status: 400 });
        try {
            return NextResponse.json(await cancelActivityChange({ profile: auth.profile, requestId: requestId || undefined, token, request }));
        } catch (error) {
            if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
            throw error;
        }
    }

    if (body.action === 'list_pending') {
        const rows = await listPendingActivityChanges(auth.profile);
        return NextResponse.json({
            responseType: 'answer',
            response: rows.length ? `יש ${rows.length} פעולות ממתינות לאישור.` : 'אין פעולות ממתינות.',
            pendingChanges: rows.map((row) => ({
                id: row.id, operation: row.operation,
                title: (row.before_snapshot as Record<string, unknown> | null)?.title_he ?? (row.proposed_changes as Record<string, unknown>)?.title_he ?? null,
                expires_at: row.expires_at, approval_method: row.approval_method,
            })),
        });
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) return NextResponse.json({ error: 'נא לכתוב בקשה.' }, { status: 400 });
    const selectedActivityId = typeof body.selectedActivityId === 'string' ? body.selectedActivityId : null;

    try {
        const result = await runAdminAssistant(
            { message, selectedActivityId, profile: auth.profile, request },
            buildDeps(),
        );
        return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
        if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
        if (error instanceof DataSourceUnavailableError) {
            return NextResponse.json({ responseType: 'system_error', response: 'מקור המידע אינו זמין כרגע. נסה שוב בעוד כמה רגעים.', intent: 'system_error', resultCount: 0, activityCards: [], eventCards: [] }, { status: 503 });
        }
        throw error;
    }
}
