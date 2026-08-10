import { NextRequest, NextResponse } from 'next/server';

import { supabaseServer } from '@/lib/supabase/server';
import type { ActivityImportDraft } from '@/lib/admin/types';

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

export async function POST(request: NextRequest) {
    const body = await request.json();
    const jobId = body?.jobId as string | undefined;

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseServer
        .from('import_jobs')
        .select('id, status')
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
        if (row.status === 'invalid') {
            skipped += 1;
            continue;
        }

        const payload = row.normalized_data as ActivityImportDraft;
        const categoryId = await ensureCategory(payload.category);
        const activityPayload = {
            title: payload.title_he,
            title_he: payload.title_he,
            description: payload.description_he,
            description_he: payload.description_he,
            category_id: categoryId,
            target_age_group: payload.target_age_group,
            min_age: payload.min_age,
            max_age: payload.max_age,
            days_of_week: payload.days_of_week,
            start_time: payload.start_time,
            end_time: payload.end_time,
            price: payload.price,
            instructor_name: payload.instructor_name,
            location: payload.location,
            max_participants: payload.max_participants,
            is_active: payload.is_active,
        };

        if (row.status === 'update_candidate' && row.duplicate_activity_id) {
            const { error } = await supabaseServer
                .from('activities')
                .update(activityPayload)
                .eq('id', row.duplicate_activity_id);

            if (error) {
                skipped += 1;
                await supabaseServer
                    .from('import_rows')
                    .update({ status: 'skipped', error_messages: [error.message] })
                    .eq('id', row.id);
                continue;
            }

            updated += 1;
            await supabaseServer.from('import_rows').update({ status: 'updated' }).eq('id', row.id);
            continue;
        }

        const { error } = await supabaseServer.from('activities').insert([activityPayload]);
        if (error) {
            skipped += 1;
            await supabaseServer
                .from('import_rows')
                .update({ status: 'skipped', error_messages: [error.message] })
                .eq('id', row.id);
            continue;
        }

        imported += 1;
        await supabaseServer.from('import_rows').update({ status: 'imported' }).eq('id', row.id);
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
        })
        .eq('id', jobId);

    return NextResponse.json({
        success: true,
        imported,
        updated,
        skipped,
    });
}
