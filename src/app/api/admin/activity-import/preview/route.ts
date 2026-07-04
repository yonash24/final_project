import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { parseSpreadsheet, buildImportPreview, type ImportMapping } from '@/lib/admin/activity-import';
import { supabaseServer } from '@/lib/supabase/server';
import type { AdminActivity } from '@/lib/admin/types';

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');
    const mappingRaw = formData.get('mapping');

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'לא נבחר קובץ לייבוא.' }, { status: 400 });
    }

    const parsedSheet = await parseSpreadsheet(file);

    if (!mappingRaw) {
        return NextResponse.json({
            headers: parsedSheet.headers,
            sampleRows: parsedSheet.rows.slice(0, 5),
            suggestedMapping: parsedSheet.suggestedMapping,
        });
    }

    const mapping = JSON.parse(String(mappingRaw)) as ImportMapping;
    const { data: activities, error: activitiesError } = await supabaseServer
        .from('activities')
        .select('id, category_id, title, title_he, description, description_he, target_age_group, min_age, max_age, days_of_week, start_time, end_time, price, instructor_name, location, max_participants, current_participants, is_active');

    if (activitiesError) {
        return NextResponse.json({ error: activitiesError.message }, { status: 500 });
    }

    const previewRows = buildImportPreview(parsedSheet.rows, mapping, (activities ?? []) as AdminActivity[]);

    const { data: job, error: jobError } = await supabaseServer
        .from('import_jobs')
        .insert([
            {
                source_filename: file.name,
                source_type: 'activities',
                total_rows: previewRows.length,
                valid_rows: previewRows.filter((row) => row.status !== 'invalid').length,
                invalid_rows: previewRows.filter((row) => row.status === 'invalid').length,
                status: 'preview',
                created_by: auth.profile.id,
            },
        ])
        .select('*')
        .single();

    if (jobError) {
        return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    const rowsPayload = previewRows.map((row) => ({
        import_job_id: job.id,
        row_index: row.rowIndex,
        source_data: parsedSheet.rows[row.rowIndex - 2],
        normalized_data: row.payload,
        status: row.status,
        duplicate_activity_id: row.duplicateActivityId,
        error_messages: row.errors,
    }));

    const { error: rowsError } = await supabaseServer.from('import_rows').insert(rowsPayload);
    if (rowsError) {
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    return NextResponse.json({
        job,
        previewRows,
    });
}
