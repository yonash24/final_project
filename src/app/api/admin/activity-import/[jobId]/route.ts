import { NextRequest, NextResponse } from 'next/server';

import { requireAdminRequest } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
    const auth = await requireAdminRequest(request);
    if (auth.response) return auth.response;
    const { jobId } = await context.params;
    const [{ data: job, error: jobError }, { data: rows, error: rowsError }] = await Promise.all([
        supabaseServer.from('import_jobs').select('*').eq('id', jobId).maybeSingle(),
        supabaseServer.from('import_rows').select('*').eq('import_job_id', jobId).order('row_index'),
    ]);
    if (jobError || rowsError) return NextResponse.json({ error: 'לא ניתן לטעון את עבודת הייבוא.' }, { status: 500 });
    if (!job) return NextResponse.json({ error: 'עבודת הייבוא לא נמצאה.' }, { status: 404 });
    return NextResponse.json({
        job,
        previewRows: (rows ?? []).map((row) => ({
            rowIndex: row.row_index,
            status: row.status,
            duplicateActivityId: row.duplicate_activity_id,
            errors: row.error_messages ?? [],
            payload: row.normalized_data,
            warnings: row.warnings ?? [],
            conflicts: row.conflicts ?? {},
            expectedUpdatedAt: row.expected_updated_at,
            confidence: typeof row.confidence_by_field?.record === 'number' ? row.confidence_by_field.record : undefined,
        })),
    });
}
