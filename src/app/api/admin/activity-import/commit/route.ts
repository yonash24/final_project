import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';
import type { ActivityImportDraft } from '@/lib/admin/types';
import { activityImportDraftSchema } from '@/lib/admin/activity-import';
import { invalidateChatCache } from '@/lib/ai/chat-cache';

async function ensureCategory(name: string | null) {
    const normalizedName = name?.trim().replace(/\s+/g, ' ');
    if (!normalizedName) return null;

    const { data: existing } = await supabaseServer
        .from('categories')
        .select('id, name_he')
        .ilike('name_he', normalizedName)
        .limit(1)
        .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabaseServer
        .from('categories')
        .insert([{ name: normalizedName, name_he: normalizedName }])
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data.id;
}

async function ensureBranch(name: string | null) {
    const normalizedName = name?.trim().replace(/\s+/g, ' ');
    if (!normalizedName) return null;
    const { data: existing } = await supabaseServer.from('branches').select('id').ilike('name', normalizedName).limit(1).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabaseServer.from('branches').insert({ name: normalizedName }).select('id').single();
    if (!error) return data.id;
    const { data: concurrent } = await supabaseServer.from('branches').select('id').ilike('name', normalizedName).limit(1).maybeSingle();
    if (concurrent) return concurrent.id;
    throw new Error(error.message);
}

const DAY_NUMBERS: Record<string, number> = {
    'ראשון': 0, sunday: 0,
    'שני': 1, monday: 1,
    'שלישי': 2, tuesday: 2,
    'רביעי': 3, wednesday: 3,
    'חמישי': 4, thursday: 4,
    'שישי': 5, friday: 5,
    'שבת': 6, saturday: 6,
};

async function replaceImportedSchedules(activityId: string, payload: ActivityImportDraft) {
    if (!payload.days_of_week) return;
    const dayNumbers = [...new Set(payload.days_of_week.split(/[,;/]+/)
        .map((day) => DAY_NUMBERS[day.trim().toLowerCase()])
        .filter((day): day is number => day !== undefined))];
    if (dayNumbers.length === 0) throw new Error('לא ניתן לזהות את יום הפעילות.');

    const { error: deleteError } = await supabaseServer.from('activity_schedules').delete().eq('activity_id', activityId);
    if (deleteError) throw new Error(deleteError.message);
    const { error } = await supabaseServer.from('activity_schedules').insert(dayNumbers.map((dayOfWeek) => ({
        activity_id: activityId,
        day_of_week: dayOfWeek,
        start_time: payload.start_time,
        end_time: payload.end_time,
    })));
    if (error) throw new Error(error.message);
}

async function recordFieldProvenance(args: {
    activityId: string;
    importRowId: string;
    sourceRevisionId: string | null;
    actorId: string | null;
}) {
    const { data: evidence, error } = await supabaseServer.from('import_evidence')
        .select('field_name,source_locator,source_excerpt,confidence')
        .eq('import_row_id', args.importRowId);
    if (error) throw new Error(error.message);
    if (!evidence?.length) return;
    const { error: upsertError } = await supabaseServer.from('activity_field_provenance').upsert(
        evidence.map((item) => ({
            activity_id: args.activityId,
            field_name: item.field_name,
            source_revision_id: args.sourceRevisionId,
            import_row_id: args.importRowId,
            source_locator: item.source_locator,
            source_excerpt: item.source_excerpt,
            confidence: item.confidence,
            recorded_by: args.actorId,
            recorded_at: new Date().toISOString(),
        })),
        { onConflict: 'activity_id,field_name' },
    );
    if (upsertError) throw new Error(upsertError.message);
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'imports:write');
    if (permissionResponse) return permissionResponse;

    const body = await request.json();
    const jobId = body?.jobId as string | undefined;
    const approvedRowIndexes = new Set<number>(Array.isArray(body?.approvedRowIndexes) ? body.approvedRowIndexes.filter((value: unknown): value is number => Number.isInteger(value)) : []);
    const conflictDecisions = new Set<string>(Array.isArray(body?.conflictDecisions) ? body.conflictDecisions.filter((value: unknown): value is string => typeof value === 'string') : []);
    const editedRows = new Map<number, unknown>(Array.isArray(body?.rowEdits) ? body.rowEdits.map((item: { rowIndex: number; payload: unknown }) => [item.rowIndex, item.payload]) : []);

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseServer
        .from('import_jobs')
        .select('id, status, source_revision_id')
        .eq('id', jobId)
        .maybeSingle();

    if (jobError) {
        return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
        return NextResponse.json({ error: 'Import job not found.' }, { status: 404 });
    }

    if (job.status !== 'preview') {
        return NextResponse.json({ error: 'This import job has already been processed.' }, { status: 409 });
    }

    const { data: claimedJob, error: claimingError } = await supabaseServer
        .from('import_jobs')
        .update({ status: 'processing' })
        .eq('id', jobId)
        .eq('status', 'preview')
        .select('id')
        .maybeSingle();

    if (claimingError) {
        return NextResponse.json({ error: claimingError.message }, { status: 500 });
    }

    if (!claimedJob) {
        return NextResponse.json({ error: 'This import job is already being processed.' }, { status: 409 });
    }

    const { data: rows, error: rowsError } = await supabaseServer
        .from('import_rows')
        .select('*')
        .eq('import_job_id', jobId)
        .order('row_index', { ascending: true });

    if (rowsError) {
        await supabaseServer
            .from('import_jobs')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', jobId);
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    try {
        for (const row of rows ?? []) {
        if (row.status === 'invalid' || !approvedRowIndexes.has(row.row_index)) {
            skipped += 1;
            await supabaseServer.from('import_rows').update({ status: 'skipped', review_decision: 'skip', reviewed_by: /^[0-9a-f-]{36}$/i.test(auth.profile.id) ? auth.profile.id : null, reviewed_at: new Date().toISOString() }).eq('id', row.id);
            continue;
        }

        const unresolvedConflict = Object.keys((row.conflicts && typeof row.conflicts === 'object' ? row.conflicts : {}) as Record<string, unknown>)
            .some((field) => !conflictDecisions.has(`${row.row_index}:${field}`));
        if (unresolvedConflict) {
            skipped += 1;
            await supabaseServer.from('import_rows').update({
                status: 'skipped',
                error_messages: ['יש להכריע בכל הסתירות לפני אישור השורה'],
                review_decision: 'skip',
            }).eq('id', row.id);
            continue;
        }

        const parsedPayload = activityImportDraftSchema.safeParse(editedRows.get(row.row_index) ?? row.normalized_data);
        if (!parsedPayload.success) {
            skipped += 1;
            await supabaseServer.from('import_rows').update({ status: 'skipped', error_messages: parsedPayload.error.issues.map((issue) => issue.message) }).eq('id', row.id);
            continue;
        }
        const payload = parsedPayload.data as ActivityImportDraft;
        await supabaseServer.from('import_rows').update({ normalized_data: payload }).eq('id', row.id);
        const categoryId = await ensureCategory(payload.category);
        const branchId = await ensureBranch(payload.location);
        const activityPayload = {
            title: payload.title_he,
            title_he: payload.title_he,
            description: payload.description_he,
            description_he: payload.description_he,
            category_id: categoryId,
            branch_id: branchId,
            target_age_group: payload.target_age_group,
            min_age: payload.min_age,
            max_age: payload.max_age,
            days_of_week: payload.days_of_week,
            start_time: payload.start_time,
            end_time: payload.end_time,
            price: payload.price,
            instructor_name: payload.instructor_name,
            location: payload.location,
            venue: payload.venue,
            group_name: payload.group_name,
            contact_name: payload.contact_name,
            contact_phone: payload.contact_phone,
            contact_email: payload.contact_email,
            notes: payload.notes,
            extra_data: payload.extra_data ?? {},
            min_grade: payload.min_grade,
            max_grade: payload.max_grade,
            max_participants: payload.max_participants,
            is_active: payload.is_active,
            publication_status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: /^[0-9a-f-]{36}$/i.test(auth.profile.id) ? auth.profile.id : null,
            source_revision_id: job.source_revision_id,
        };

        const reviewedBy = /^[0-9a-f-]{36}$/i.test(auth.profile.id) ? auth.profile.id : null;
        if ((row.status === 'update_candidate' || row.status === 'conflict') && row.duplicate_activity_id) {
            const { data: currentActivity, error: currentError } = await supabaseServer.from('activities')
                .select('updated_at,extra_data').eq('id', row.duplicate_activity_id).maybeSingle();
            if (currentError || !currentActivity || (row.expected_updated_at && currentActivity.updated_at !== row.expected_updated_at)) {
                skipped += 1;
                await supabaseServer.from('import_rows').update({ status: 'skipped', error_messages: ['החוג השתנה מאז התצוגה המקדימה. יש ליצור ייבוא חדש.'] }).eq('id', row.id);
                continue;
            }
            const safeUpdatePayload = Object.fromEntries(Object.entries(activityPayload).filter(([field, value]) =>
                value != null && value !== '' && !(field === 'extra_data' && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0),
            ));
            if (activityPayload.extra_data && Object.keys(activityPayload.extra_data).length > 0) {
                safeUpdatePayload.extra_data = { ...(currentActivity.extra_data ?? {}), ...activityPayload.extra_data };
            }
            const { data: updatedActivity, error } = await supabaseServer
                .from('activities')
                .update(safeUpdatePayload)
                .eq('id', row.duplicate_activity_id)
                .eq('updated_at', currentActivity.updated_at)
                .select('id').single();

            if (error) {
                skipped += 1;
                await supabaseServer
                    .from('import_rows')
                    .update({ status: 'skipped', error_messages: [error.message] })
                    .eq('id', row.id);
                continue;
            }

            await replaceImportedSchedules(updatedActivity.id, payload);
            await recordFieldProvenance({ activityId: updatedActivity.id, importRowId: row.id, sourceRevisionId: job.source_revision_id, actorId: reviewedBy });
            updated += 1;
            await supabaseServer.from('import_rows').update({ status: 'updated', review_decision: 'approve', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() }).eq('id', row.id);
            continue;
        }

        const { data: insertedActivity, error } = await supabaseServer.from('activities').insert([activityPayload]).select('id').single();
        if (error) {
            skipped += 1;
            await supabaseServer
                .from('import_rows')
                .update({ status: 'skipped', error_messages: [error.message] })
                .eq('id', row.id);
            continue;
        }

        await replaceImportedSchedules(insertedActivity.id, payload);
        await recordFieldProvenance({ activityId: insertedActivity.id, importRowId: row.id, sourceRevisionId: job.source_revision_id, actorId: reviewedBy });
        imported += 1;
        await supabaseServer.from('import_rows').update({ status: 'imported', review_decision: 'approve', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() }).eq('id', row.id);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed.';
        await supabaseServer
            .from('import_jobs')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', jobId);
        return NextResponse.json({ error: message, imported, updated, skipped }, { status: 500 });
    }

    await supabaseServer
        .from('import_jobs')
        .update({
            status: 'completed',
            imported_count: imported,
            updated_count: updated,
            skipped_count: skipped,
            completed_at: new Date().toISOString(),
            completed_by: /^[0-9a-f-]{36}$/i.test(auth.profile.id) ? auth.profile.id : null,
        })
        .eq('id', jobId);

    if (imported > 0 || updated > 0) void invalidateChatCache();

    return NextResponse.json({
        success: true,
        imported,
        updated,
        skipped,
    });
}
