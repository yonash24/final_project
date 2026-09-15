import { NextRequest, NextResponse } from 'next/server';

import { parseAdminCommand } from '@/lib/admin/admin-command';
import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { ActivityChangeError, autoExecuteActivityChange, confirmActivityChange, OPERATION_PERMISSION, proposeActivityChange } from '@/lib/admin/activity-changes';
import { resolveAdminActivitySelector } from '@/lib/admin/activity-selector';
import { DataSourceUnavailableError } from '@/lib/db/data-source';

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const body = await request.json();

    if (body.action === 'confirm') {
        const permission = requirePermission(auth.profile, 'activity:update');
        if (permission) return permission;
        const token = typeof body.token === 'string' ? body.token : '';
        try {
            return NextResponse.json(await confirmActivityChange({ profile: auth.profile, token, request }));
        } catch (error) {
            if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
            throw error;
        }
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) return NextResponse.json({ error: 'נא לכתוב בקשה.' }, { status: 400 });
    const command = await parseAdminCommand(message);
    if (command.operation === 'query') {
        const permission = requirePermission(auth.profile, 'activity:read');
        if (permission) return permission;
        try {
            const matches = await resolveAdminActivitySelector({
                ...command.target_selector,
                name: command.target_selector.name ?? command.target_name,
            }, 'all');
            return NextResponse.json({
                responseType: 'results',
                response: matches.length ? `נמצאו ${matches.length} חוגים, כולל טיוטות ופריטים בארכיון בהתאם להרשאת הניהול.` : 'לא נמצאו חוגים מתאימים.',
                intent: 'admin_activity_query', resultCount: matches.length, activityCards: matches, eventCards: [],
            });
        } catch (error) {
            if (error instanceof DataSourceUnavailableError) {
                return NextResponse.json({ responseType: 'system_error', response: 'מקור המידע אינו זמין כרגע. נסה שוב בעוד כמה רגעים.', intent: 'system_error', resultCount: 0, activityCards: [], eventCards: [] }, { status: 503 });
            }
            throw error;
        }
    }
    if (command.operation === 'cancel' || command.operation === 'list_pending') {
        return NextResponse.json({ responseType: 'clarification', response: 'פקודות ביטול והצגת פעולות ממתינות זמינות כרגע ב־WhatsApp.' });
    }
    const permission = requirePermission(auth.profile, OPERATION_PERMISSION[command.operation]);
    if (permission) return permission;
    if (command.confidence < 0.75) return NextResponse.json({ responseType: 'clarification', response: 'לא זיהיתי בוודאות את החוג או את השינוי. נא לציין שם חוג מדויק וערך חדש.' });

    let target = null;
    if (command.operation !== 'create_draft') {
        const selector = {
            ...command.target_selector,
            name: command.target_selector.name ?? command.target_name,
        };
        if (!Object.values(selector).some((value) => value != null && value !== '')) {
            return NextResponse.json({ responseType: 'clarification', response: 'איזה חוג ברצונך לשנות? אפשר לציין שם, סניף, יום ושעה.' });
        }
        let matches;
        try {
            matches = await resolveAdminActivitySelector(selector, command.operation === 'restore' ? 'archived' : command.operation === 'publish' ? 'draft' : 'active');
        } catch (error) {
            if (error instanceof DataSourceUnavailableError) return NextResponse.json({ error: 'מקור המידע אינו זמין כרגע.' }, { status: 503 });
            throw error;
        }
        if (matches.length !== 1) return NextResponse.json({
            responseType: 'clarification',
            response: matches.length ? 'נמצאו כמה חוגים מתאימים. בחרו את החוג המדויק לפי הסניף, היום והשעה.' : 'לא נמצא חוג שמתאים לכל התנאים שצוינו.',
            activityCards: matches,
        });
        target = matches[0];
    } else if (!command.changes.title_he) {
        return NextResponse.json({ responseType: 'clarification', response: 'כדי ליצור חוג חדש יש לציין לפחות שם חוג.' });
    }

    try {
        if (command.operation === 'create_draft' || command.operation === 'update') {
            return NextResponse.json(await autoExecuteActivityChange({
                profile: auth.profile,
                operation: command.operation,
                activityId: target?.id,
                changes: command.changes,
                request,
            }));
        }
        return NextResponse.json(await proposeActivityChange({
            profile: auth.profile,
            operation: command.operation,
            activityId: target?.id,
            changes: command.changes,
            request,
        }));
    } catch (error) {
        if (error instanceof ActivityChangeError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
    }
}
