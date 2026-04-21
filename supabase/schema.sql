-- Smart Digital Community Center (Matnas) Schema

-- Enable pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_he TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activities Table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    title_he TEXT NOT NULL,
    description TEXT,
    description_he TEXT,
    target_age_group TEXT, -- e.g., 'kids', 'teens', 'adults', 'seniors'
    min_age INT,
    max_age INT,
    level TEXT, -- e.g., 'beginner', 'intermediate', 'advanced'
    days_of_week TEXT, -- e.g., 'Sunday,Tuesday'
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
    
    -- Full-text search and embeddings
    search_vector tsvector,
    embedding vector(1536) -- Using OpenAI standard; if using Gemini models text-embedding-004 defaults to 768, we can change to 768. Let's use 768 since we're using Gemini.
);

-- Update embedding to 768 for Gemini embedding models
ALTER TABLE public.activities ALTER COLUMN embedding TYPE vector(768);

-- 3. Marketing Assets Table
CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- e.g., 'flyer', 'social_post'
    content_text TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'draft',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chat Sessions Table (Optional, for persisting history if we want DB instead of sessionStorage)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to handle full-text search indexing
CREATE OR REPLACE FUNCTION trigger_set_search_vector() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- We include the Hebrew title and description for search.
  NEW.search_vector :=
     setweight(to_tsvector('simple', COALESCE(NEW.title_he, '')), 'A') ||
     setweight(to_tsvector('simple', COALESCE(NEW.description_he, '')), 'B');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tz_activities_search_vector ON public.activities;
CREATE TRIGGER tz_activities_search_vector
BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION trigger_set_search_vector();

-- Row Level Security (RLS) setup (For this prototype, allow anon read access)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on categories" ON public.categories;
CREATE POLICY "Allow public read access on categories" ON public.categories FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow public read access on activities" ON public.activities;
CREATE POLICY "Allow public read access on activities" ON public.activities FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow admin full access on categories" ON public.categories;
CREATE POLICY "Allow admin full access on categories" ON public.categories FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin full access on activities" ON public.activities;
CREATE POLICY "Allow admin full access on activities" ON public.activities FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin full access on marketing" ON public.marketing_assets;
CREATE POLICY "Allow admin full access on marketing" ON public.marketing_assets FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow public full access to sessions" ON public.chat_sessions;
CREATE POLICY "Allow public full access to sessions" ON public.chat_sessions FOR ALL USING (true);
