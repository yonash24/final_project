import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { parseSpreadsheet, parseActivityDocument, buildImportPreview, type ImportMapping } from '@/lib/admin/activity-import';
import { requireAdminRequest, requirePermission } from '@/lib/admin/auth';
import { fetchOfficialPubluuPdf, isPubluuHost } from '@/lib/admin/publuu';
import { supabaseServer } from '@/lib/supabase/server';
import type { AdminActivity } from '@/lib/admin/types';

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const permissionResponse = requirePermission(auth.profile, 'imports:write');
    if (permissionResponse) return permissionResponse;

    try {
        const formData = await request.formData();
        let file = formData.get('file');
        const mappingRaw = formData.get('mapping');
        const publuuPdfUrl = formData.get('publuuPdfUrl') ? String(formData.get('publuuPdfUrl')).trim() : '';

        if (!(file instanceof File) && !publuuPdfUrl) {
            return NextResponse.json({ error: 'לא נבחר קובץ לייבוא.' }, { status: 400 });
        }

        if (!(file instanceof File) && publuuPdfUrl) {
            try {
                file = await fetchOfficialPubluuPdf(publuuPdfUrl);
            } catch (error) {
                return NextResponse.json({ error: error instanceof Error ? error.message : 'לא ניתן להוריד את קובץ Publuu.' }, { status: 400 });
            }
        }

        if (!(file instanceof File)) return NextResponse.json({ error: 'קובץ הייבוא אינו תקין.' }, { status: 400 });

        if (file.size === 0) {
            return NextResponse.json({ error: 'הקובץ ריק.' }, { status: 400 });
        }

        if (file.size > MAX_IMPORT_BYTES) {
            return NextResponse.json({ error: 'גודל הקובץ מוגבל ל־25MB.' }, { status: 413 });
        }

        const extension = file.name.toLowerCase().split('.').pop() ?? '';
        if (!['csv', 'xlsx', 'pdf', 'docx', 'doc'].includes(extension)) {
            return NextResponse.json({ error: 'סוג הקובץ אינו נתמך.' }, { status: 415 });
        }
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const startsWith = (signature: number[]) => signature.every((byte, index) => fileBytes[index] === byte);
        if (extension === 'pdf' && !startsWith([0x25, 0x50, 0x44, 0x46])) {
            return NextResponse.json({ error: 'הקובץ אינו PDF תקין.' }, { status: 415 });
        }
        if (['xlsx', 'docx'].includes(extension) && !startsWith([0x50, 0x4b])) {
            return NextResponse.json({ error: 'מבנה קובץ Office אינו תקין.' }, { status: 415 });
        }
        const publuuValue = formData.get('publuuUrl') ? String(formData.get('publuuUrl')).trim() : '';
        if (publuuValue) {
            try {
                const url = new URL(publuuValue);
                if (url.protocol !== 'https:' || !isPubluuHost(url.hostname)) throw new Error('invalid host');
            } catch {
                return NextResponse.json({ error: 'קישור Publuu חייב להיות כתובת HTTPS תקינה תחת publuu.com.' }, { status: 400 });
            }
        }

        const parsedSheet = ['pdf', 'docx', 'doc'].includes(extension)
            ? await parseActivityDocument(file)
            : await parseSpreadsheet(file);
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

        const previewRows = buildImportPreview(parsedSheet.rows, mapping, (activities ?? []) as AdminActivity[]).map((row, index) => ({
            ...row,
            confidence: parsedSheet.evidence?.[index]?.confidence,
            warnings: parsedSheet.evidence?.[index] && parsedSheet.evidence[index].confidence < 0.75 ? ['ביטחון חילוץ נמוך - נדרשת בדיקה'] : [],
        }));

        const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
        const actorId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(auth.profile.id) ? auth.profile.id : null;
        const sourceType = publuuValue || publuuPdfUrl ? 'publuu' : extension;
        const { data: source, error: sourceError } = await supabaseServer.from('import_sources').insert({
            source_type: sourceType,
            display_name: file.name,
            publuu_url: publuuValue || publuuPdfUrl || null,
            created_by: actorId,
        }).select('id').single();
        if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
        const storagePath = `${source.id}/${sha256}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const upload = await supabaseServer.storage.from('activity-imports').upload(storagePath, fileBytes, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
        const { data: revision, error: revisionError } = await supabaseServer.from('source_revisions').insert({
            source_id: source.id, storage_path: storagePath, sha256, mime_type: file.type || 'application/octet-stream', size_bytes: file.size, extractor_version: 'safe-import-v1', created_by: actorId,
        }).select('id').single();
        if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 });

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
                created_by: actorId,
                source_revision_id: revision.id,
            },
        ])
        .select('*')
        .single();

        if (jobError) {
            return NextResponse.json({ error: jobError.message }, { status: 500 });
        }

    const rowsPayload = previewRows.map((row, index) => ({
        import_job_id: job.id,
        row_index: row.rowIndex,
        source_data: parsedSheet.rows[row.rowIndex - 2],
        normalized_data: row.payload,
        status: row.status,
        duplicate_activity_id: row.duplicateActivityId,
        error_messages: row.errors,
        confidence_by_field: parsedSheet.evidence?.[index] ? { record: parsedSheet.evidence[index].confidence } : {},
        warnings: parsedSheet.evidence?.[index] && parsedSheet.evidence[index].confidence < 0.75 ? ['ביטחון חילוץ נמוך - נדרשת בדיקה'] : [],
    }));

        const { data: savedRows, error: rowsError } = await supabaseServer.from('import_rows').insert(rowsPayload).select('id,row_index');
        if (rowsError) {
            return NextResponse.json({ error: rowsError.message }, { status: 500 });
        }
        const evidenceRows = (savedRows ?? []).flatMap((saved) => {
            const evidence = parsedSheet.evidence?.[saved.row_index - 2];
            return evidence ? [{ import_row_id: saved.id, field_name: 'record', source_locator: { page: evidence.page }, source_excerpt: evidence.excerpt, confidence: evidence.confidence }] : [];
        });
        if (evidenceRows.length) await supabaseServer.from('import_evidence').insert(evidenceRows);

        return NextResponse.json({
            job,
            previewRows,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'לא ניתן לקרוא את הקובץ.';
        return NextResponse.json({ error: `שגיאה בקריאת הקובץ: ${message}` }, { status: 400 });
    }
}
