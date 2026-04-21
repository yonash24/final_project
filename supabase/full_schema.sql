-- Smart Digital Community Center (Matnas) COMPREHENSIVE Schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_he TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activities (Classes) Table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    title_he TEXT NOT NULL,
    description TEXT,
    description_he TEXT,
    target_age_group TEXT, -- 'kids', 'teens', 'adults', 'seniors'
    min_age INT,
    max_age INT,
    level TEXT, -- 'beginner', 'intermediate', 'advanced'
    days_of_week TEXT, -- 'Sunday,Tuesday'
    start_time TIME,
    end_time TIME,
    start_date DATE,
    end_date DATE,
    price NUMERIC(10, 2) DEFAULT 0.00,
    max_participants INT DEFAULT 20,
    current_participants INT DEFAULT 0,
    instructor_name TEXT,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Search & Vector
    search_vector tsvector,
    embedding vector(768) -- Gemini Text Embedding 004
);

-- 3. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location TEXT,
    category TEXT,
    max_attendees INT,
    current_attendees INT DEFAULT 0,
    image_url TEXT,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Members (Residents) Table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    birth_date DATE,
    join_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Activity Registrations (Pivot)
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'enrolled' -- 'enrolled', 'completed', 'waiting_list', 'cancelled'
);

-- 6. Marketing Assets (AI Generated)
CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- 'flyer', 'social_post', 'whatsapp_msg'
    content_text TEXT,
    image_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Community Feed Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name TEXT NOT NULL,
    author_role TEXT DEFAULT 'resident', -- 'resident', 'admin', 'youth_leader'
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search functionality
CREATE OR REPLACE FUNCTION trigger_set_search_vector() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
     setweight(to_tsvector('simple', COALESCE(NEW.title_he, '')), 'A') ||
     setweight(to_tsvector('simple', COALESCE(NEW.description_he, '')), 'B');
  RETURN NEW;
END
$$;

CREATE TRIGGER tz_activities_search_vector
BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION trigger_set_search_vector();

-- Security Policies (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Allow public read, authenticated write
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Activities" ON public.activities FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Events" ON public.events FOR SELECT TO public USING (true);
CREATE POLICY "Public Read Posts" ON public.posts FOR SELECT TO public USING (true);

-- Admin policies (requires auth)
CREATE POLICY "Admin All Categories" ON public.categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Activities" ON public.activities FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Events" ON public.events FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Members" ON public.members FOR ALL TO authenticated USING (true);
