import { NextRequest, NextResponse } from 'next/server';

import { parseAdminCommand } from '@/lib/admin/admin-command';
import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { ActivityChangeError, confirmActivityChange, proposeActivityChange } from '@/lib/admin/activity-changes';
import { resolveAdminActivitySelector } from '@/lib/admin/activity-selector';
import { getChatResponse } from '@/lib/ai/chat-service';
import { DataSourceUnavailableError } from '@/lib/db/data-source';

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const body = await request.json();

    if (body.action === 'confirm') {
        const permission = requirePermission(auth.profile, 'content:write');
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
        const selector = {
            ...command.target_selector,
            name: command.target_selector.name ?? command.target_name,
        };
        if (!Object.values(selector).some((value) => value != null && value !== '')) {
            return NextResponse.json({ responseType: 'clarification', response: 'איזה חוג ברצונך לשנות? אפשר לציין שם, סניף, יום ושעה.' });
        }
        let matches;
        try {
            matches = await resolveAdminActivitySelector(selector);
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
