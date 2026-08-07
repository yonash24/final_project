import { NextRequest, NextResponse } from 'next/server';

import { parseSpreadsheet, buildImportPreview, type ImportMapping } from '@/lib/admin/activity-import';
import { supabaseServer } from '@/lib/supabase/server';
import type { AdminActivity } from '@/lib/admin/types';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const mappingRaw = formData.get('mapping');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'לא נבחר קובץ לייבוא.' }, { status: 400 });
        }

        if (file.size === 0) {
            return NextResponse.json({ error: 'הקובץ ריק.' }, { status: 400 });
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'גודל הקובץ מוגבל ל־10MB.' }, { status: 413 });
        }

        const parsedSheet = await parseSpreadsheet(file);
        if (parsedSheet.headers.length === 0 || parsedSheet.rows.length === 0) {
            return NextResponse.json({ error: 'לא נמצאו כותרות או שורות נתונים בקובץ.' }, { status: 400 });
        }

        if (parsedSheet.rows.length > 10_000) {
            return NextResponse.json({ error: 'ניתן לייבא עד 10,000 שורות בכל קובץ.' }, { status: 413 });
        }

        if (!mappingRaw) {
            return NextResponse.json({
                headers: parsedSheet.headers,
                sampleRows: parsedSheet.rows.slice(0, 5),
                suggestedMapping: parsedSheet.suggestedMapping,
            });
        }

        let mapping: ImportMapping;
        try {
            const parsedMapping = JSON.parse(String(mappingRaw));
            if (!parsedMapping || typeof parsedMapping !== 'object' || Array.isArray(parsedMapping)) {
                throw new Error('mapping must be an object');
            }
            mapping = parsedMapping as ImportMapping;
        } catch {
            return NextResponse.json({ error: 'מיפוי העמודות אינו תקין.' }, { status: 400 });
        }

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
    } catch (error) {
        const message = error instanceof Error ? error.message : 'לא ניתן לקרוא את הקובץ.';
        return NextResponse.json({ error: `שגיאה בקריאת הקובץ: ${message}` }, { status: 400 });
    }
}
