-- Safe activity search, document provenance, and confirmed admin mutations.

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('csv','xlsx','doc','docx','pdf','publuu')),
    display_name TEXT NOT NULL,
    publuu_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.import_sources(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 26214400),
    page_count INTEGER CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 150),
    extractor_version TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_id, sha256)
);

ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS venue TEXT,
    ADD COLUMN IF NOT EXISTS group_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS min_grade INTEGER,
    ADD COLUMN IF NOT EXISTS max_grade INTEGER,
    ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source_revision_id UUID REFERENCES public.source_revisions(id) ON DELETE SET NULL;

UPDATE public.activities
SET publication_status = CASE WHEN is_active THEN 'approved' ELSE 'archived' END,
    approved_at = CASE WHEN is_active THEN COALESCE(approved_at, updated_at, created_at, now()) ELSE approved_at END
WHERE publication_status IS NULL OR (publication_status = 'approved' AND NOT is_active);

INSERT INTO public.branches (name)
SELECT DISTINCT trim(location) FROM public.activities
WHERE location IS NOT NULL AND trim(location) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.activities a
SET branch_id = b.id
FROM public.branches b
WHERE a.branch_id IS NULL AND trim(a.location) = b.name;

CREATE TABLE IF NOT EXISTS public.activity_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_time IS NULL OR end_time IS NULL OR start_time < end_time),
    UNIQUE(activity_id, day_of_week, start_time, end_time)
);

INSERT INTO public.activity_schedules (activity_id, day_of_week, start_time, end_time)
SELECT a.id,
    CASE trim(day_name)
        WHEN 'ראשון' THEN 0 WHEN 'Sunday' THEN 0
        WHEN 'שני' THEN 1 WHEN 'Monday' THEN 1
        WHEN 'שלישי' THEN 2 WHEN 'Tuesday' THEN 2
        WHEN 'רביעי' THEN 3 WHEN 'Wednesday' THEN 3
        WHEN 'חמישי' THEN 4 WHEN 'Thursday' THEN 4
        WHEN 'שישי' THEN 5 WHEN 'Friday' THEN 5
        WHEN 'שבת' THEN 6 WHEN 'Saturday' THEN 6
    END,
    a.start_time, a.end_time
FROM public.activities a
CROSS JOIN LATERAL regexp_split_to_table(COALESCE(a.days_of_week, ''), '[,;/]+') AS day_name
WHERE trim(day_name) IN ('ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
ON CONFLICT DO NOTHING;

ALTER TABLE public.import_jobs
    ADD COLUMN IF NOT EXISTS source_revision_id UUID REFERENCES public.source_revisions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS extraction_cursor INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.import_rows
    ADD COLUMN IF NOT EXISTS confidence_by_field JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS review_decision TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.import_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_row_id UUID NOT NULL REFERENCES public.import_rows(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    source_locator JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_excerpt TEXT,
    confidence NUMERIC(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_email TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create','update','archive')),
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    before_snapshot JSONB,
    proposed_changes JSONB NOT NULL,
    expected_updated_at TIMESTAMPTZ,
    nonce_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','expired','stale','failed')),
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
    ALTER TABLE public.activities ADD CONSTRAINT activities_publication_status_valid
        CHECK (publication_status IN ('draft','approved','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.activities ADD CONSTRAINT activities_grade_range_valid
        CHECK ((min_grade IS NULL OR min_grade BETWEEN 0 AND 12)
           AND (max_grade IS NULL OR max_grade BETWEEN 0 AND 12)
           AND (min_grade IS NULL OR max_grade IS NULL OR min_grade <= max_grade));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS activities_safe_search_idx
    ON public.activities (publication_status, is_active, branch_id, min_age, max_age);
CREATE INDEX IF NOT EXISTS activity_schedules_search_idx
    ON public.activity_schedules (day_of_week, start_time, end_time, activity_id);
CREATE INDEX IF NOT EXISTS import_jobs_processing_idx
    ON public.import_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS activity_change_requests_actor_idx
    ON public.activity_change_requests (actor_user_id, status, expires_at);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read branches" ON public.branches FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Public read branch aliases" ON public.branch_aliases FOR SELECT TO public USING (true);
CREATE POLICY "Public read approved schedules" ON public.activity_schedules FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM public.activities a WHERE a.id = activity_id AND a.is_active AND a.publication_status = 'approved'));
CREATE POLICY "Admins manage branches" ON public.branches FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage branch aliases" ON public.branch_aliases FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage import sources" ON public.import_sources FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage source revisions" ON public.source_revisions FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage schedules" ON public.activity_schedules FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage import evidence" ON public.import_evidence FOR ALL TO authenticated
USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage change requests" ON public.activity_change_requests FOR ALL TO authenticated
USING (actor_user_id = auth.uid() AND public.is_admin_user())
WITH CHECK (actor_user_id = auth.uid() AND public.is_admin_user());

-- Restrict public activity reads to approved, non-archived rows.
DROP POLICY IF EXISTS "Public read activities" ON public.activities;
CREATE POLICY "Public read activities" ON public.activities FOR SELECT TO public
USING (is_active = true AND publication_status = 'approved' AND archived_at IS NULL);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('activity-imports', 'activity-imports', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

CREATE POLICY "Admins upload activity imports" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'activity-imports' AND public.is_admin_user());
CREATE POLICY "Admins read activity imports" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'activity-imports' AND public.is_admin_user());
