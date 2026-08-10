-- Keep one canonical category per Hebrew display name. Older imports could
-- create the same category repeatedly because categories had no unique key.
DO $$
DECLARE
    duplicate RECORD;
    canonical_id UUID;
BEGIN
    FOR duplicate IN
        SELECT lower(trim(name_he)) AS category_key
        FROM public.categories
        GROUP BY lower(trim(name_he))
        HAVING count(*) > 1
    LOOP
        SELECT id INTO canonical_id
        FROM public.categories
        WHERE lower(trim(name_he)) = duplicate.category_key
        ORDER BY created_at NULLS FIRST, id
        LIMIT 1;

        UPDATE public.activities
        SET category_id = canonical_id
        WHERE category_id IN (
            SELECT id FROM public.categories
            WHERE lower(trim(name_he)) = duplicate.category_key
              AND id <> canonical_id
        );

        DELETE FROM public.categories
        WHERE lower(trim(name_he)) = duplicate.category_key
          AND id <> canonical_id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_he_normalized_idx
    ON public.categories (lower(trim(name_he)));
