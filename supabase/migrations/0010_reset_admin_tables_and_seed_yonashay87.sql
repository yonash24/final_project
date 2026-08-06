-- Reset admin-related public tables and seed them with the requested admin profile.
-- Important:
-- - `public.management_users` is legacy and not used by the current admin login flow.
-- - `public.admin_users` controls access after a successful Supabase Auth login.
-- - Supabase Auth users themselves are not managed by this SQL migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    admin_email text := 'yonashay87@gmail.com';
    admin_password text := '123456';
    auth_user_id uuid;
BEGIN
    -- Full reset of the public tables the app uses for admin-related data.
    TRUNCATE TABLE public.admin_users RESTART IDENTITY CASCADE;
    TRUNCATE TABLE public.management_users RESTART IDENTITY CASCADE;

    -- Seed the legacy management table for completeness / backwards compatibility.
    INSERT INTO public.management_users (email, password, full_name)
    VALUES (
        admin_email,
        crypt(admin_password, gen_salt('bf')),
        'Yonash'
    );

    -- If the Supabase Auth user already exists, grant admin access immediately.
    SELECT id
    INTO auth_user_id
    FROM auth.users
    WHERE email = admin_email
    LIMIT 1;

    IF auth_user_id IS NOT NULL THEN
        INSERT INTO public.admin_users (id, email, role)
        VALUES (auth_user_id, admin_email, 'super_admin');
    ELSE
        RAISE NOTICE 'No auth.users row found for %, so admin login will still require creating the Supabase Auth user separately.', admin_email;
    END IF;
END $$;
