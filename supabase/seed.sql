-- Basic seed data for testing
-- Ensure categories exist
INSERT INTO public.categories (name, name_he, icon) VALUES 
('Sports', 'ספורט', 'Activity'),
('Arts & Crafts', 'אמנות ויצירה', 'Palette'),
('Music', 'מוזיקה', 'Music'),
('Technology', 'טכנולוגיה', 'Computer'),
('Dance', 'ריקוד', 'UserRoundCheck'),
('Language', 'שפות', 'Languages');

-- (We will add the activities directly via UI or a robust seed script later, as UUIDs need mapping)
