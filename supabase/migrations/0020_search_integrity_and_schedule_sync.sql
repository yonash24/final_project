-- Keep legacy schedule columns and the normalized schedule table consistent
-- for all existing write paths until callers are fully migrated.
CREATE OR REPLACE FUNCTION public.sync_activity_schedules_from_legacy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.activity_schedules WHERE activity_id = NEW.id;

    INSERT INTO public.activity_schedules (activity_id, day_of_week, start_time, end_time)
    SELECT NEW.id,
        CASE trim(day_name)
            WHEN 'ראשון' THEN 0 WHEN 'Sunday' THEN 0
            WHEN 'שני' THEN 1 WHEN 'Monday' THEN 1
            WHEN 'שלישי' THEN 2 WHEN 'Tuesday' THEN 2
            WHEN 'רביעי' THEN 3 WHEN 'Wednesday' THEN 3
            WHEN 'חמישי' THEN 4 WHEN 'Thursday' THEN 4
            WHEN 'שישי' THEN 5 WHEN 'Friday' THEN 5
            WHEN 'שבת' THEN 6 WHEN 'Saturday' THEN 6
        END,
        NEW.start_time, NEW.end_time
    FROM regexp_split_to_table(COALESCE(NEW.days_of_week, ''), '[,;/]+') AS day_name
    WHERE trim(day_name) IN ('ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_sync_schedules ON public.activities;
CREATE TRIGGER activities_sync_schedules
AFTER INSERT OR UPDATE OF days_of_week, start_time, end_time ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.sync_activity_schedules_from_legacy();

-- Vector search must observe the same publication boundary as structured search.
CREATE OR REPLACE FUNCTION public.match_activities_by_embedding(
    query_embedding vector(768), match_threshold float DEFAULT 0.5, match_count int DEFAULT 8
)
RETURNS TABLE (
    id UUID, title TEXT, title_he TEXT, description TEXT, description_he TEXT,
    target_age_group TEXT, min_age INT, max_age INT, days_of_week TEXT,
    start_time TIME, end_time TIME, price NUMERIC(10,2), instructor_name TEXT,
    location TEXT, max_participants INT, current_participants INT,
    is_active BOOLEAN, category_name_he TEXT, similarity float
)
LANGUAGE sql STABLE AS $$
    SELECT a.id, a.title, a.title_he, a.description, a.description_he,
      a.target_age_group, a.min_age, a.max_age, a.days_of_week, a.start_time,
      a.end_time, a.price, a.instructor_name, a.location, a.max_participants,
      a.current_participants, a.is_active, c.name_he,
      1 - (a.embedding <=> query_embedding)
    FROM public.activities a
    LEFT JOIN public.categories c ON c.id = a.category_id
    WHERE a.is_active = true AND a.publication_status = 'approved'
      AND a.archived_at IS NULL AND a.embedding IS NOT NULL
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.find_similar_activities(
    activity_id UUID, match_count int DEFAULT 4
)
RETURNS TABLE (
    id UUID, title_he TEXT, description_he TEXT, days_of_week TEXT,
    start_time TIME, price NUMERIC(10,2), min_age INT, max_age INT,
    location TEXT, category_name_he TEXT, similarity float
)
LANGUAGE sql STABLE AS $$
    WITH source AS (SELECT embedding FROM public.activities WHERE id = activity_id)
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
