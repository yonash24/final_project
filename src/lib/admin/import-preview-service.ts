import crypto from 'node:crypto';

import { supabaseServer } from '@/lib/supabase/server';
import { buildImportPreview, type ImportMapping, type ParsedSheetResult } from './activity-import';
import type { AdminProfile } from './auth';
import type { AdminActivity } from './types';

function actorId(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;
}

export async function persistImportPreview(args: {
    file: File;
    fileBytes: Uint8Array;
    parsedSheet: ParsedSheetResult;
    mapping: ImportMapping;
    profile: AdminProfile;
    sourceType: string;
    publuuUrl?: string | null;
}) {
    const { data: activities, error: activitiesError } = await supabaseServer.from('activities')
        .select('id,category_id,title,title_he,description,description_he,target_age_group,min_age,max_age,min_grade,max_grade,days_of_week,start_time,end_time,price,instructor_name,location,venue,group_name,contact_name,contact_phone,contact_email,notes,max_participants,current_participants,is_active,updated_at')
        .eq('is_active', true).eq('publication_status', 'approved').is('archived_at', null);
    if (activitiesError) throw new Error(activitiesError.message);

    const previewRows = buildImportPreview(args.parsedSheet.rows, args.mapping, (activities ?? []) as AdminActivity[]).map((row, index) => ({
        ...row,
        confidence: args.parsedSheet.evidence?.[index]?.confidence,
        warnings: args.parsedSheet.evidence?.[index] && args.parsedSheet.evidence[index].confidence < 0.75
            ? ['ביטחון חילוץ נמוך - נדרשת בדיקה'] : [],
    }));
    const sha256 = crypto.createHash('sha256').update(args.fileBytes).digest('hex');
    const createdBy = actorId(args.profile.id);
    const { data: source, error: sourceError } = await supabaseServer.from('import_sources').insert({
        source_type: args.sourceType,
        display_name: args.file.name,
        publuu_url: args.publuuUrl ?? null,
        created_by: createdBy,
    }).select('id').single();
    if (sourceError) throw new Error(sourceError.message);

    const storagePath = `${source.id}/${sha256}-${args.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await supabaseServer.storage.from('activity-imports').upload(storagePath, args.fileBytes, {
        contentType: args.file.type || 'application/octet-stream', upsert: false,
    });
    if (upload.error) throw new Error(upload.error.message);
    const { data: revision, error: revisionError } = await supabaseServer.from('source_revisions').insert({
        source_id: source.id, storage_path: storagePath, sha256,
        mime_type: args.file.type || 'application/octet-stream', size_bytes: args.file.size,
        extractor_version: 'safe-import-v2', created_by: createdBy,
    }).select('id').single();
    if (revisionError) throw new Error(revisionError.message);

    const { data: job, error: jobError } = await supabaseServer.from('import_jobs').insert({
        source_filename: args.file.name, source_type: 'activities', total_rows: previewRows.length,
        valid_rows: previewRows.filter((row) => row.status !== 'invalid').length,
        invalid_rows: previewRows.filter((row) => row.status === 'invalid').length,
        status: 'preview', created_by: createdBy, source_revision_id: revision.id,
    }).select('*').single();
    if (jobError) throw new Error(jobError.message);

    const { data: savedRows, error: rowsError } = await supabaseServer.from('import_rows').insert(previewRows.map((row, index) => ({
        import_job_id: job.id,
        row_index: row.rowIndex,
        source_data: args.parsedSheet.rows[row.rowIndex - 2],
        normalized_data: row.payload,
        status: row.status,
        duplicate_activity_id: row.duplicateActivityId,
        error_messages: row.errors,
        confidence_by_field: args.parsedSheet.evidence?.[index]
            ? (Object.keys(args.parsedSheet.evidence[index].confidenceByField ?? {}).length
                ? args.parsedSheet.evidence[index].confidenceByField
                : { record: args.parsedSheet.evidence[index].confidence }) : {},
        warnings: row.warnings ?? [],
        conflicts: row.conflicts ?? {},
        expected_updated_at: row.expectedUpdatedAt ?? null,
    }))).select('id,row_index');
    if (rowsError) throw new Error(rowsError.message);

    const evidenceRows = (savedRows ?? []).flatMap((saved) => {
        const evidence = args.parsedSheet.evidence?.[saved.row_index - 2];
        if (!evidence) return [];
        const locator = { page: evidence.page, sheet: evidence.sheet ?? null, row: evidence.row ?? null };
        const fields = Object.entries(evidence.confidenceByField ?? {});
        return fields.length
            ? fields.map(([fieldName, confidence]) => ({ import_row_id: saved.id, field_name: fieldName, source_locator: locator, source_excerpt: evidence.excerpt, confidence }))
            : [{ import_row_id: saved.id, field_name: 'record', source_locator: locator, source_excerpt: evidence.excerpt, confidence: evidence.confidence }];
    });
    if (evidenceRows.length) {
        const { error } = await supabaseServer.from('import_evidence').insert(evidenceRows);
        if (error) throw new Error(error.message);
    }
    return { job, previewRows };
}
