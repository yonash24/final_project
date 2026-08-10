-- Basic seed data for testing
-- Ensure categories exist
INSERT INTO public.categories (name, name_he, icon)
SELECT seed.name, seed.name_he, seed.icon
FROM (VALUES
    ('Sports', 'ספורט', 'Activity'),
    ('Arts & Crafts', 'אמנות ויצירה', 'Palette'),
    ('Music', 'מוזיקה', 'Music'),
    ('Technology', 'טכנולוגיה', 'Computer'),
    ('Dance', 'ריקוד', 'UserRoundCheck'),
    ('Language', 'שפות', 'Languages')
) AS seed(name, name_he, icon)
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories existing
    WHERE lower(trim(existing.name_he)) = lower(trim(seed.name_he))
);

-- (We will add the activities directly via UI or a robust seed script later, as UUIDs need mapping)
