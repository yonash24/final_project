-- Seed admin access for a known Supabase Auth user.
-- Passwords are managed by Supabase Auth, not by this migration.
-- If the user does not yet exist in auth.users, run the existing
-- `src/scripts/ensure-admin.ts` bootstrap script to create/update the account.

DO $$
DECLARE
    admin_email text := 'yonashay87@gmail.com';
    admin_user_id uuid;
BEGIN
    SELECT id
    INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email
    LIMIT 1;

    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'Auth user % was not found. Create it via the admin bootstrap script, then rerun this migration or keep the script as the source of truth.', admin_email;
        RETURN;
    END IF;

    INSERT INTO public.admin_users (id, email, role)
    VALUES (admin_user_id, admin_email, 'super_admin')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = EXCLUDED.role;
END $$;
