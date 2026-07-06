-- Migration 0007: AI Upgrade — Knowledge Base, Vector Search, Chat Insights, Waitlist & Feedback
-- Adds: knowledge_base table, vector search RPCs, chat_query_logs, feedback table, waitlist support

-- ============================================================
-- 1. Knowledge Base (FAQs, center info, policies)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'faq',  -- 'faq', 'policy', 'hours', 'contact', 'general'
    title TEXT NOT NULL,
    title_he TEXT NOT NULL,
    content TEXT NOT NULL,
    content_he TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Knowledge Base" ON public.knowledge_base;
CREATE POLICY "Public Read Knowledge Base" ON public.knowledge_base
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Anon Write Knowledge Base" ON public.knowledge_base;
CREATE POLICY "Anon Write Knowledge Base" ON public.knowledge_base
    FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Events embedding column (activities already has it)
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS embedding vector(768);

-- ============================================================
-- 3. Vector Search RPCs
-- ============================================================

-- Match activities by embedding similarity
CREATE OR REPLACE FUNCTION match_activities_by_embedding(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 8
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    title_he TEXT,
    description TEXT,
    description_he TEXT,
    target_age_group TEXT,
    min_age INT,
    max_age INT,
    days_of_week TEXT,
    start_time TIME,
    end_time TIME,
    price NUMERIC(10,2),
    instructor_name TEXT,
    location TEXT,
    max_participants INT,
    current_participants INT,
    is_active BOOLEAN,
    category_name_he TEXT,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id, a.title, a.title_he, a.description, a.description_he,
        a.target_age_group, a.min_age, a.max_age, a.days_of_week,
        a.start_time, a.end_time, a.price, a.instructor_name, a.location,
        a.max_participants, a.current_participants, a.is_active,
        c.name_he AS category_name_he,
        1 - (a.embedding <=> query_embedding) AS similarity
    FROM public.activities a
    LEFT JOIN public.categories c ON a.category_id = c.id
    WHERE a.is_active = true
      AND a.embedding IS NOT NULL
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Match knowledge base by embedding similarity
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    title_he TEXT,
    content_he TEXT,
    tags TEXT[],
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id, kb.category, kb.title_he, kb.content_he, kb.tags,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_base kb
    WHERE kb.is_active = true
      AND kb.embedding IS NOT NULL
      AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Match events by embedding similarity
CREATE OR REPLACE FUNCTION match_events_by_embedding(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date DATE,
    start_time TIME,
    end_time TIME,
    location TEXT,
    type TEXT,
    category TEXT,
    max_attendees INT,
    current_attendees INT,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.description, e.event_date,
        e.start_time, e.end_time, e.location, e.type, e.category,
        e.max_attendees, e.current_attendees,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM public.events e
    WHERE e.is_published = true
      AND e.embedding IS NOT NULL
      AND e.event_date >= CURRENT_DATE
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Find similar activities to a given one
CREATE OR REPLACE FUNCTION find_similar_activities(
    activity_id UUID,
    match_count int DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    title_he TEXT,
    description_he TEXT,
    days_of_week TEXT,
    start_time TIME,
    price NUMERIC(10,2),
    min_age INT,
    max_age INT,
    location TEXT,
    category_name_he TEXT,
    similarity float
)
LANGUAGE plpgsql AS $$
DECLARE
    source_embedding vector(768);
BEGIN
    SELECT a.embedding INTO source_embedding
    FROM public.activities a WHERE a.id = activity_id;

    IF source_embedding IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        a.id, a.title_he, a.description_he, a.days_of_week,
        a.start_time, a.price, a.min_age, a.max_age, a.location,
        c.name_he AS category_name_he,
        1 - (a.embedding <=> source_embedding) AS similarity
    FROM public.activities a
    LEFT JOIN public.categories c ON a.category_id = c.id
    WHERE a.is_active = true
      AND a.id != activity_id
      AND a.embedding IS NOT NULL
    ORDER BY a.embedding <=> source_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- 4. Chat Query Logs (for admin insights)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    intent TEXT,
    had_results BOOLEAN DEFAULT false,
    hit_count INT DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_query_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public manage chat query logs" ON public.chat_query_logs;
CREATE POLICY "Public manage chat query logs" ON public.chat_query_logs
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Upsert RPC for logging queries
CREATE OR REPLACE FUNCTION log_chat_query(
    p_query TEXT,
    p_intent TEXT,
    p_had_results BOOLEAN
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.chat_query_logs (query, intent, had_results, hit_count, first_seen_at, last_seen_at)
    VALUES (p_query, p_intent, p_had_results, 1, NOW(), NOW())
    ON CONFLICT (( (query) ))
    DO UPDATE SET
        hit_count = chat_query_logs.hit_count + 1,
        last_seen_at = NOW(),
        had_results = p_had_results OR chat_query_logs.had_results;
EXCEPTION WHEN OTHERS THEN
    -- If unique constraint doesn't exist, just insert
    INSERT INTO public.chat_query_logs (query, intent, had_results)
    VALUES (p_query, p_intent, p_had_results);
END;
$$;

-- Create unique index on query for upsert
CREATE UNIQUE INDEX IF NOT EXISTS chat_query_logs_query_idx ON public.chat_query_logs (query);

-- ============================================================
-- 5. Feedback Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    feedback_type TEXT NOT NULL DEFAULT 'general', -- 'registration', 'event', 'chat', 'general'
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    user_name TEXT,
    user_phone TEXT,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public manage feedback" ON public.feedback;
CREATE POLICY "Public manage feedback" ON public.feedback
    FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- 6. Waitlist support — add waitlist_position column to registrations
-- ============================================================

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_phone TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS waitlist_position INT,
ADD COLUMN IF NOT EXISTS waitlist_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
