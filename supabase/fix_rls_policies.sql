-- Fix RLS: allow anon key to write activities and events
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "Anon Write Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Delete Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Update Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Write Events" ON public.events;
DROP POLICY IF EXISTS "Anon Delete Events" ON public.events;
DROP POLICY IF EXISTS "Anon Update Events" ON public.events;
DROP POLICY IF EXISTS "Anon Write Posts" ON public.posts;
DROP POLICY IF EXISTS "Anon Delete Posts" ON public.posts;

CREATE POLICY "Anon Write Activities" ON public.activities FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anon Delete Activities" ON public.activities FOR DELETE TO public USING (true);
CREATE POLICY "Anon Update Activities" ON public.activities FOR UPDATE TO public USING (true);
CREATE POLICY "Anon Write Events" ON public.events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anon Delete Events" ON public.events FOR DELETE TO public USING (true);
CREATE POLICY "Anon Update Events" ON public.events FOR UPDATE TO public USING (true);
CREATE POLICY "Anon Write Posts" ON public.posts FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anon Delete Posts" ON public.posts FOR DELETE TO public USING (true);

-- Add missing columns if not exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'פיזי';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title TEXT;
