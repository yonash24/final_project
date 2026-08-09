-- Migration 0013: Atomic activity registration and capacity enforcement
-- A registration and its capacity update must succeed or fail together.

-- Reconcile the denormalized counter with successful, non-cancelled
-- registrations before enforcing capacity.
WITH registration_counts AS (
    SELECT
        activity_id,
        COUNT(*)::INT AS participant_count
    FROM public.registrations
    WHERE activity_id IS NOT NULL
      AND status IN ('pending', 'confirmed', 'enrolled')
    GROUP BY activity_id
)
UPDATE public.activities AS activities
SET current_participants = COALESCE(registration_counts.participant_count, 0)
FROM registration_counts
WHERE activities.id = registration_counts.activity_id;

UPDATE public.activities AS activities
SET current_participants = 0
WHERE NOT EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE registrations.activity_id = activities.id
      AND registrations.status IN ('pending', 'confirmed', 'enrolled')
);

CREATE INDEX IF NOT EXISTS registrations_activity_phone_active_idx
    ON public.registrations (activity_id, user_phone)
    WHERE status IN ('pending', 'confirmed', 'enrolled');

CREATE OR REPLACE FUNCTION public.register_for_activity(
    p_activity_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    registration_id UUID,
    activity_id UUID,
    member_id UUID,
    status TEXT,
    current_participants INT,
    max_participants INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member_id UUID;
    v_registration_id UUID;
    v_activity_id UUID;
    v_current_participants INT;
    v_max_participants INT;
    v_is_active BOOLEAN;
BEGIN
    IF p_activity_id IS NULL
       OR NULLIF(BTRIM(p_full_name), '') IS NULL
       OR NULLIF(BTRIM(p_phone), '') IS NULL THEN
        RAISE EXCEPTION 'invalid_registration_input'
            USING ERRCODE = 'P0001';
    END IF;

    -- Lock the activity row for the whole transaction. This serializes
    -- concurrent registrations for the same activity and prevents overbooking.
    SELECT
        activities.id,
        COALESCE(activities.current_participants, 0),
        activities.max_participants,
        activities.is_active
    INTO
        v_activity_id,
        v_current_participants,
        v_max_participants,
        v_is_active
    FROM public.activities AS activities
    WHERE activities.id = p_activity_id
    FOR UPDATE;

    IF v_activity_id IS NULL THEN
        RAISE EXCEPTION 'activity_not_found'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'activity_inactive'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.registrations AS registrations
        WHERE registrations.activity_id = p_activity_id
          AND registrations.user_phone = BTRIM(p_phone)
          AND registrations.status IN ('pending', 'confirmed', 'enrolled')
    ) THEN
        RAISE EXCEPTION 'already_registered'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_max_participants IS NOT NULL
       AND v_current_participants >= v_max_participants THEN
        RAISE EXCEPTION 'activity_full'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.members (full_name, phone, email, updated_at)
    VALUES (BTRIM(p_full_name), BTRIM(p_phone), NULLIF(BTRIM(p_email), ''), NOW())
    ON CONFLICT (phone) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW()
    RETURNING id INTO v_member_id;

    INSERT INTO public.registrations (
        member_id,
        activity_id,
        user_name,
        user_phone,
        user_email,
        notes,
        status,
        created_at
    )
    VALUES (
        v_member_id,
        p_activity_id,
        BTRIM(p_full_name),
        BTRIM(p_phone),
        NULLIF(BTRIM(p_email), ''),
        NULLIF(BTRIM(p_notes), ''),
        'pending',
        NOW()
    )
    RETURNING id INTO v_registration_id;

    UPDATE public.activities AS activities
    SET current_participants = COALESCE(activities.current_participants, 0) + 1
    WHERE activities.id = p_activity_id;

    RETURN QUERY
    SELECT
        v_registration_id,
        p_activity_id,
        v_member_id,
        'pending'::TEXT,
        v_current_participants + 1,
        v_max_participants;
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_activity(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_for_activity(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Registrations must go through the capacity-safe function. Keep admin access
-- and remove the older public direct-insert/full-access policies.
DROP POLICY IF EXISTS "Enable public insert for registrations" ON public.registrations;
DROP POLICY IF EXISTS "Public full access registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anon Write Registrations" ON public.registrations;

-- Keep activity data publicly readable, but prevent clients from changing the
-- denormalized capacity counter outside the guarded registration function.
DROP POLICY IF EXISTS "Public full access activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Write Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Update Activities" ON public.activities;
DROP POLICY IF EXISTS "Anon Delete Activities" ON public.activities;

DROP POLICY IF EXISTS "Public read activities after capacity enforcement" ON public.activities;
CREATE POLICY "Public read activities after capacity enforcement" ON public.activities
    FOR SELECT TO public USING (true);
