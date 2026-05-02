-- Migration: Register people to events and courses + Admin Access

-- 1. Create members table to store participant information
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Update registrations table to support events and courses
-- If registrations table doesn't exist, create it. If it does, we'll try to add event_id.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'registrations') THEN
        CREATE TABLE public.registrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id UUID REFERENCES public.members(id),
            activity_id UUID REFERENCES public.activities(id), -- Courses
            event_id UUID REFERENCES public.events(id),
            status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
            payment_status TEXT DEFAULT 'unpaid',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
    ELSE
        -- Add event_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registrations' AND column_name='event_id') THEN
            ALTER TABLE public.registrations ADD COLUMN event_id UUID REFERENCES public.events(id);
        END IF;
        -- Add member_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='registrations' AND column_name='member_id') THEN
            ALTER TABLE public.registrations ADD COLUMN member_id UUID REFERENCES public.members(id);
        END IF;
    END IF;
END $$;

-- 3. Create admin_users table for management panel access control
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- admin, super_admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for admin access)
CREATE POLICY "Admins can do everything on members" ON public.members
    FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Admins can do everything on registrations" ON public.registrations
    FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Admins can view admin_users" ON public.admin_users
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
