-- Migration: tighten admin auth and add activity import audit tables

CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_filename TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'activities',
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    invalid_rows INT NOT NULL DEFAULT 0,
    imported_count INT NOT NULL DEFAULT 0,
    updated_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'preview',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'preview',
    duplicate_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    error_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage import_jobs" ON public.import_jobs;
CREATE POLICY "Admins can manage import_jobs" ON public.import_jobs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage import_rows" ON public.import_rows;
CREATE POLICY "Admins can manage import_rows" ON public.import_rows
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Anon Write Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Delete Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Update Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Write Events" ON public.events;
DROP POLICY IF EXISTS "Anon Delete Events" ON public.events;
DROP POLICY IF EXISTS "Anon Update Events" ON public.events;
DROP POLICY IF EXISTS "Anon Write Posts" ON public.posts;
DROP POLICY IF EXISTS "Anon Delete Posts" ON public.posts;
DROP POLICY IF EXISTS "Anon Write Members" ON public.members;
DROP POLICY IF EXISTS "Anon Delete Members" ON public.members;
