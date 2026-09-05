-- Close every legacy public activity-read path and make publication status a
-- mandatory boundary for both relational and vector search.

DROP POLICY IF EXISTS "Allow public read access on activities" ON public.activities;
DROP POLICY IF EXISTS "Public Read Activities" ON public.activities;
DROP POLICY IF EXISTS "Public read activities" ON public.activities;
DROP POLICY IF EXISTS "Public read activities after capacity enforcement" ON public.activities;
DROP POLICY IF EXISTS "Public full access activities" ON public.activities;

CREATE POLICY "Public read approved activities" ON public.activities
    FOR SELECT TO anon, authenticated
    USING (
        is_active = true
        AND publication_status = 'approved'
        AND archived_at IS NULL
    );

-- The service-role-backed application still applies this predicate itself,
-- but keeping it in the RPC prevents future callers from bypassing it.
DROP FUNCTION IF EXISTS public.match_activities_by_embedding(vector, double precision, integer);
CREATE FUNCTION public.match_activities_by_embedding(
    query_embedding vector(768), match_threshold float DEFAULT 0.5, match_count int DEFAULT 8
)
RETURNS TABLE (
    id UUID, title TEXT, title_he TEXT, description TEXT, description_he TEXT,
    target_age_group TEXT, min_age INT, max_age INT, days_of_week TEXT,
    start_time TIME, end_time TIME, price NUMERIC(10,2), instructor_name TEXT,
    location TEXT, max_participants INT, current_participants INT,
    is_active BOOLEAN, publication_status TEXT, category_name_he TEXT, similarity float
)
LANGUAGE sql STABLE AS $$
    SELECT a.id, a.title, a.title_he, a.description, a.description_he,
      a.target_age_group, a.min_age, a.max_age, a.days_of_week, a.start_time,
      a.end_time, a.price, a.instructor_name, a.location, a.max_participants,
      a.current_participants, a.is_active, a.publication_status, c.name_he,
      1 - (a.embedding <=> query_embedding)
    FROM public.activities a
    LEFT JOIN public.categories c ON c.id = a.category_id
    WHERE a.is_active = true
      AND a.publication_status = 'approved'
      AND a.archived_at IS NULL
      AND a.embedding IS NOT NULL
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
$$;

DROP FUNCTION IF EXISTS public.match_activities_filtered(vector, double precision, integer, integer, text[], numeric, boolean, boolean);
CREATE FUNCTION public.match_activities_filtered(
    query_embedding vector(768), match_threshold float DEFAULT 0.45, match_count integer DEFAULT 8,
    exact_age integer DEFAULT NULL, requested_days text[] DEFAULT NULL, max_price numeric DEFAULT NULL,
    free_only boolean DEFAULT false, requires_availability boolean DEFAULT false
)
RETURNS TABLE (
    id uuid, title text, title_he text, description text, description_he text,
    target_age_group text, min_age integer, max_age integer, days_of_week text,
    start_time time, end_time time, price numeric, instructor_name text,
    location text, max_participants integer, current_participants integer,
    is_active boolean, publication_status text, category_name_he text, similarity float
) LANGUAGE sql STABLE AS $$
    SELECT a.id, a.title, a.title_he, a.description, a.description_he,
      a.target_age_group, a.min_age, a.max_age, a.days_of_week, a.start_time,
      a.end_time, a.price, a.instructor_name, a.location, a.max_participants,
      a.current_participants, a.is_active, a.publication_status, c.name_he,
      1 - (a.embedding <=> query_embedding)
    FROM public.activities a
    LEFT JOIN public.categories c ON c.id = a.category_id
    WHERE a.is_active = true
      AND a.publication_status = 'approved'
      AND a.archived_at IS NULL
      AND a.embedding IS NOT NULL
      AND (exact_age IS NULL OR (
          a.min_age IS NOT NULL AND a.max_age IS NOT NULL
          AND a.min_age <= exact_age AND a.max_age >= exact_age
      ))
      AND (requested_days IS NULL OR cardinality(requested_days) = 0 OR EXISTS (
          SELECT 1 FROM unnest(requested_days) d WHERE a.days_of_week ILIKE '%' || d || '%'
      ))
      AND (max_price IS NULL OR (a.price IS NOT NULL AND a.price <= max_price))
      AND (NOT free_only OR a.price = 0)
      AND (NOT requires_availability OR (
          a.max_participants IS NOT NULL
          AND COALESCE(a.current_participants, 0) < a.max_participants
      ))
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding, a.id
    LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_activities_by_embedding(vector, float, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_activities_by_embedding(vector, float, integer) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_activities_filtered(vector, float, integer, integer, text[], numeric, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_activities_filtered(vector, float, integer, integer, text[], numeric, boolean, boolean) TO anon, authenticated, service_role;

-- Registrations must pass through the server route, which checks the same
-- publication boundary before invoking the capacity-safe transaction.
REVOKE EXECUTE ON FUNCTION public.register_for_activity(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_activity(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.find_similar_activities(
    activity_id UUID, match_count int DEFAULT 4
)
RETURNS TABLE (
    id UUID, title_he TEXT, description_he TEXT, days_of_week TEXT,
    start_time TIME, price NUMERIC(10,2), min_age INT, max_age INT,
    location TEXT, category_name_he TEXT, similarity float
)
LANGUAGE sql STABLE AS $$
    WITH source AS (
        SELECT embedding FROM public.activities
        WHERE id = activity_id AND is_active = true
          AND publication_status = 'approved' AND archived_at IS NULL
    )
    SELECT a.id, a.title_he, a.description_he, a.days_of_week, a.start_time,
      a.price, a.min_age, a.max_age, a.location, c.name_he,
      1 - (a.embedding <=> source.embedding)
    FROM public.activities a
    CROSS JOIN source
    LEFT JOIN public.categories c ON c.id = a.category_id
    WHERE a.is_active = true AND a.publication_status = 'approved'
      AND a.archived_at IS NULL AND a.id <> activity_id AND a.embedding IS NOT NULL
    ORDER BY a.embedding <=> source.embedding
    LIMIT match_count;
$$;

-- Latest accepted source evidence for each canonical activity field.
CREATE TABLE IF NOT EXISTS public.activity_field_provenance (
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    source_revision_id UUID REFERENCES public.source_revisions(id) ON DELETE SET NULL,
    import_row_id UUID REFERENCES public.import_rows(id) ON DELETE SET NULL,
    source_locator JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_excerpt TEXT,
    confidence NUMERIC(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, field_name)
);

ALTER TABLE public.activity_field_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activity provenance" ON public.activity_field_provenance
    FOR ALL TO authenticated
    USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
REVOKE ALL ON public.activity_field_provenance FROM anon;

ALTER TABLE public.import_rows
    ADD COLUMN IF NOT EXISTS conflicts JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS expected_updated_at TIMESTAMPTZ;

-- A WhatsApp number receives management privileges only after an authenticated
-- administrator explicitly links it on the website.
CREATE TABLE IF NOT EXISTS public.admin_channel_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('twilio-whatsapp','meta-cloud-api')),
    contact_phone TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, contact_phone),
    UNIQUE(admin_user_id, provider)
);

ALTER TABLE public.admin_channel_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own channel identities" ON public.admin_channel_identities
    FOR ALL TO authenticated
    USING (admin_user_id = auth.uid() AND public.is_admin_user())
    WITH CHECK (admin_user_id = auth.uid() AND public.is_admin_user());
REVOKE ALL ON public.admin_channel_identities FROM anon;
