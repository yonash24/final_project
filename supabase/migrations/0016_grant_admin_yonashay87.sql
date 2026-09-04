    -- Grant admin access to an existing Supabase Auth user.
    -- Passwords must be managed by Supabase Auth, never stored in SQL tables.

    DO $$
    DECLARE
        admin_email TEXT := 'yonashay87@gmail.com';
        admin_user_id UUID;
    BEGIN
        SELECT id
        INTO admin_user_id
        FROM auth.users
        WHERE lower(email) = lower(admin_email)
        LIMIT 1;

        IF admin_user_id IS NULL THEN
            RAISE EXCEPTION
                'Supabase Auth user % was not found. Create it first, then run this migration again.',
                admin_email;
        END IF;

        INSERT INTO public.admin_users (id, email, role, is_active)
        VALUES (admin_user_id, admin_email, 'super_admin', true)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            role = 'super_admin',
            is_active = true;
    END $$;
