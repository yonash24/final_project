-- Migration: Custom Management Users table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.management_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Will store hashed passwords
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert the requested admin
INSERT INTO public.management_users (email, password, full_name)
VALUES (
    'yonashay87@gmail.com', 
    crypt('123456', gen_salt('bf')), 
    'Yona Admin'
) ON CONFLICT (email) DO UPDATE 
SET password = crypt('123456', gen_salt('bf'));

-- 4. Create function to verify password
CREATE OR REPLACE FUNCTION verify_admin_password(p_email TEXT, p_password TEXT)
RETURNS TABLE (id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.email, m.full_name
    FROM management_users m
    WHERE m.email = p_email
    AND m.password = crypt(p_password, m.password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

