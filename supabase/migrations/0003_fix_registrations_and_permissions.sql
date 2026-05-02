-- Migration: Fix registrations table and permissions
-- 1. Add missing columns to registrations for quick compatibility
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_phone TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. Allow anyone to submit a registration (Public Access)
DROP POLICY IF EXISTS "Enable public insert for registrations" ON public.registrations;
CREATE POLICY "Enable public insert for registrations" ON public.registrations
    FOR INSERT WITH CHECK (true);

-- 3. Allow anyone to create/update their member profile
DROP POLICY IF EXISTS "Enable public insert for members" ON public.members;
CREATE POLICY "Enable public insert for members" ON public.members
    FOR INSERT WITH CHECK (true);

-- 4. Ensure phone is unique for members to support upsert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_phone_key') THEN
        ALTER TABLE public.members ADD CONSTRAINT members_phone_key UNIQUE (phone);
    END IF;
END $$;
