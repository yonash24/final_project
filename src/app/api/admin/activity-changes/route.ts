import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import {
    ActivityChangeError,
    confirmActivityChange,
    proposeActivityChange,
} from '@/lib/admin/activity-changes';

const requestSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('confirm'), token: z.string().min(1).max(200) }),
    z.object({
        action: z.literal('propose'),
        operation: z.enum(['create', 'update', 'archive']),
        activityId: z.string().uuid().nullable().optional(),
        expectedUpdatedAt: z.string().nullable().optional(),
        changes: z.unknown().optional(),
    }),
]);

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permission = requirePermission(auth.profile, 'content:write');
    if (permission) return permission;

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'בקשת השינוי אינה תקינה.' }, { status: 400 });
    try {
        if (parsed.data.action === 'confirm') {
            return NextResponse.json(await confirmActivityChange({ profile: auth.profile, token: parsed.data.token, request }));
        }
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

