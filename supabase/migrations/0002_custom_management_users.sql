-- Legacy custom management auth has been deprecated in favor of Supabase Auth.
-- Keep the table for backward compatibility during migrations, but do not seed
-- any credentials or rely on it for admin login.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.management_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
