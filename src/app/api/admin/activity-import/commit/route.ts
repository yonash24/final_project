import { NextRequest, NextResponse } from 'next/server';

import { supabaseServer } from '@/lib/supabase/server';
import type { ActivityImportDraft } from '@/lib/admin/types';

async function ensureCategory(name: string | null) {
    if (!name) return null;

    const { data: existing } = await supabaseServer
        .from('categories')
        .select('id')
        .eq('name_he', name)
        .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabaseServer
        .from('categories')
        .insert([{ name: name, name_he: name }])
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

    const { data: rows, error: rowsError } = await supabaseServer
        .from('import_rows')
        .select('*')
        .eq('import_job_id', jobId)
        .order('row_index', { ascending: true });

    if (rowsError) {
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

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
