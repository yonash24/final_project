-- Forward-only recommendation safety upgrade. Apply after 0016.

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS min_age integer,
    ADD COLUMN IF NOT EXISTS max_age integer,
    ADD COLUMN IF NOT EXISTS target_age_group text,
    ADD COLUMN IF NOT EXISTS audience_tags text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_family_friendly boolean,
    ADD COLUMN IF NOT EXISTS requires_adult_companion boolean;

ALTER TABLE public.activities
    ADD CONSTRAINT activities_min_age_nonnegative CHECK (min_age IS NULL OR min_age >= 0) NOT VALID,
    ADD CONSTRAINT activities_max_age_nonnegative CHECK (max_age IS NULL OR max_age >= 0) NOT VALID,
    ADD CONSTRAINT activities_age_range_valid CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age) NOT VALID,
    ADD CONSTRAINT activities_price_nonnegative CHECK (price IS NULL OR price >= 0) NOT VALID,
    ADD CONSTRAINT activities_participants_nonnegative CHECK (current_participants IS NULL OR current_participants >= 0) NOT VALID;

ALTER TABLE public.events
    ADD CONSTRAINT events_age_range_valid CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age) NOT VALID,
    ADD CONSTRAINT events_ages_nonnegative CHECK ((min_age IS NULL OR min_age >= 0) AND (max_age IS NULL OR max_age >= 0)) NOT VALID,
    ADD CONSTRAINT events_age_group_valid CHECK (target_age_group IS NULL OR target_age_group IN ('kids', 'teens', 'adults', 'seniors')) NOT VALID;

CREATE INDEX IF NOT EXISTS events_chat_audience_age_idx ON public.events (min_age, max_age, target_age_group) WHERE is_published = true;

DROP FUNCTION IF EXISTS public.match_activities_filtered(vector, double precision, integer, integer, text[], numeric, boolean, boolean);
CREATE OR REPLACE FUNCTION public.match_activities_filtered(
    query_embedding vector(768), match_threshold float DEFAULT 0.45, match_count integer DEFAULT 8,
    exact_age integer DEFAULT NULL, requested_days text[] DEFAULT NULL, max_price numeric DEFAULT NULL,
    free_only boolean DEFAULT false, requires_availability boolean DEFAULT false
)
RETURNS TABLE (
    id uuid, title text, title_he text, description text, description_he text, target_age_group text,
    min_age integer, max_age integer, days_of_week text, start_time time, end_time time, price numeric,
    instructor_name text, location text, max_participants integer, current_participants integer,
    is_active boolean, category_name_he text, similarity float
) LANGUAGE sql STABLE AS $$
    SELECT a.id, a.title, a.title_he, a.description, a.description_he, a.target_age_group,
      a.min_age, a.max_age, a.days_of_week, a.start_time, a.end_time, a.price, a.instructor_name,
      a.location, a.max_participants, a.current_participants, a.is_active, c.name_he,
      1 - (a.embedding <=> query_embedding)
    FROM public.activities a LEFT JOIN public.categories c ON c.id = a.category_id
    WHERE a.is_active = true AND a.embedding IS NOT NULL
      AND (exact_age IS NULL OR (a.min_age IS NOT NULL AND a.max_age IS NOT NULL AND a.min_age <= exact_age AND a.max_age >= exact_age))
      AND (requested_days IS NULL OR cardinality(requested_days) = 0 OR EXISTS (
          SELECT 1 FROM unnest(requested_days) d WHERE a.days_of_week ILIKE '%' || d || '%'))
      AND (max_price IS NULL OR (a.price IS NOT NULL AND a.price <= max_price))
      AND (NOT free_only OR a.price = 0)
      AND (NOT requires_availability OR a.max_participants IS NULL OR COALESCE(a.current_participants, 0) < a.max_participants)
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding, a.id
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_activities_filtered(vector, float, integer, integer, text[], numeric, boolean, boolean) TO anon, authenticated;
