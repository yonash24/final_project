import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import {
    ActivityChangeError,
    cancelActivityChange,
    confirmActivityChange,
    confirmHighRiskActivityChange,
    OPERATION_PERMISSION,
    proposeActivityChange,
} from '@/lib/admin/activity-changes';
import { createSSRClient, supabaseServer } from '@/lib/supabase/server';
import { notifySuperAdminsOfActivityChange } from '@/lib/notifications/service';

const requestSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('confirm'), token: z.string().min(1).max(200) }),
    z.object({ action: z.literal('confirm_high_risk'), requestId: z.string().uuid() }),
    z.object({ action: z.literal('cancel'), requestId: z.string().uuid() }),
    z.object({
        action: z.literal('propose'),
        operation: z.enum(['create_draft', 'update', 'archive', 'restore', 'publish']),
        activityId: z.string().uuid().nullable().optional(),
        expectedUpdatedAt: z.string().nullable().optional(),
        changes: z.unknown().optional(),
    }),
]);

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'בקשת השינוי אינה תקינה.' }, { status: 400 });
    try {
        if (parsed.data.action === 'confirm') {
            return NextResponse.json(await confirmActivityChange({ profile: auth.profile, token: parsed.data.token, request }));
        }
        if (parsed.data.action === 'cancel') {
            return NextResponse.json(await cancelActivityChange({ profile: auth.profile, requestId: parsed.data.requestId, request }));
        }
        if (parsed.data.action === 'confirm_high_risk') {
            const { data: pending } = await supabaseServer.from('activity_change_requests').select('operation')
                .eq('id', parsed.data.requestId).eq('actor_email', auth.profile.email).eq('status', 'pending').maybeSingle();
            const required = pending?.operation && pending.operation in OPERATION_PERMISSION ? OPERATION_PERMISSION[pending.operation as keyof typeof OPERATION_PERMISSION] : 'activity:publish';
            const operationPermission = requirePermission(auth.profile, required);
            if (operationPermission) return operationPermission;
            const ssr = await createSSRClient();
            const { data: assurance } = await ssr.auth.mfa.getAuthenticatorAssuranceLevel();
            if (assurance?.currentLevel !== 'aal2') {
                return NextResponse.json({ error: 'נדרש אימות דו-שלבי לפני אישור פעולה זו.', mfaRequired: true }, { status: 403 });
            }
            const confirmed = await confirmHighRiskActivityChange({ profile: auth.profile, requestId: parsed.data.requestId, request });
            void notifySuperAdminsOfActivityChange({ operation: confirmed.operation, activity: confirmed.result });
            return NextResponse.json(confirmed);
        }
        const permission = requirePermission(auth.profile, OPERATION_PERMISSION[parsed.data.operation]);
        if (permission) return permission;
        return NextResponse.json(await proposeActivityChange({
            profile: auth.profile,
            operation: parsed.data.operation,
            activityId: parsed.data.activityId,
            expectedUpdatedAt: parsed.data.expectedUpdatedAt,
            changes: parsed.data.changes,
            request,
        }));
    } catch (error) {
        if (error instanceof ActivityChangeError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
    }
}
