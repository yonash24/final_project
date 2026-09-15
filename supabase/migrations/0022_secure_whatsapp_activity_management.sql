-- Secure, identity-bound WhatsApp activity management.

ALTER TABLE public.admin_users
    DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('viewer', 'editor', 'manager', 'super_admin'));

CREATE TABLE IF NOT EXISTS public.admin_channel_link_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('twilio-whatsapp','meta-cloud-api')),
    expected_phone TEXT NOT NULL,
    code_hash TEXT NOT NULL UNIQUE,
    attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count BETWEEN 0 AND 5),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_channel_link_challenges_active_idx
    ON public.admin_channel_link_challenges (admin_user_id, provider)
    WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_channel_link_challenges_lookup_idx
    ON public.admin_channel_link_challenges (provider, expected_phone, expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.admin_whatsapp_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_identity_id UUID NOT NULL REFERENCES public.admin_channel_identities(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    state_type TEXT NOT NULL CHECK (state_type IN ('activity_selection')),
    original_command JSONB NOT NULL,
    candidate_ids UUID[] NOT NULL CHECK (cardinality(candidate_ids) BETWEEN 1 AND 20),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_whatsapp_states_active_idx
    ON public.admin_whatsapp_states (channel_identity_id, state_type)
    WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.consume_whatsapp_rate_limit(p_rate_key TEXT, p_max_requests INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
    INSERT INTO public.whatsapp_rate_limits(rate_key,window_started_at,request_count,updated_at)
    VALUES (p_rate_key,now(),1,now())
    ON CONFLICT (rate_key) DO UPDATE SET
        window_started_at=CASE WHEN whatsapp_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now() ELSE whatsapp_rate_limits.window_started_at END,
        request_count=CASE WHEN whatsapp_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1 ELSE whatsapp_rate_limits.request_count + 1 END,
        updated_at=now()
    RETURNING request_count INTO v_count;
    RETURN v_count <= p_max_requests;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_whatsapp_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_whatsapp_rate_limit(TEXT,INTEGER,INTEGER) TO service_role;

ALTER TABLE public.activity_change_requests
    ADD COLUMN IF NOT EXISTS channel_identity_id UUID REFERENCES public.admin_channel_identities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_message_id TEXT,
    ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS approval_method TEXT NOT NULL DEFAULT 'web_token',
    ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmation_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.activity_change_requests
    DROP CONSTRAINT IF EXISTS activity_change_requests_operation_check;
UPDATE public.activity_change_requests SET operation = 'create_draft' WHERE operation = 'create';
ALTER TABLE public.activity_change_requests
    ADD CONSTRAINT activity_change_requests_operation_check
    CHECK (operation IN ('create_draft','update','archive','restore','publish'));
ALTER TABLE public.activity_change_requests
    DROP CONSTRAINT IF EXISTS activity_change_requests_risk_level_check;
ALTER TABLE public.activity_change_requests
    ADD CONSTRAINT activity_change_requests_risk_level_check
    CHECK (risk_level IN ('medium','high'));
ALTER TABLE public.activity_change_requests
    DROP CONSTRAINT IF EXISTS activity_change_requests_approval_method_check;
ALTER TABLE public.activity_change_requests
    ADD CONSTRAINT activity_change_requests_approval_method_check
    CHECK (approval_method IN ('web_token','whatsapp_code','web_mfa'));

CREATE UNIQUE INDEX IF NOT EXISTS activity_change_requests_source_message_idx
    ON public.activity_change_requests (channel_identity_id, source_message_id)
    WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_change_requests_channel_pending_idx
    ON public.activity_change_requests (channel_identity_id, status, expires_at);

ALTER TABLE public.admin_channel_identities
    ADD COLUMN IF NOT EXISTS confirmation_failures INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS confirmation_locked_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.register_admin_confirmation_failure(p_identity_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.admin_channel_identities
    SET confirmation_failures = CASE
            WHEN confirmation_locked_until IS NOT NULL AND confirmation_locked_until <= now() THEN 1
            ELSE confirmation_failures + 1
        END,
        confirmation_locked_until = CASE
            WHEN (CASE WHEN confirmation_locked_until IS NOT NULL AND confirmation_locked_until <= now() THEN 1 ELSE confirmation_failures + 1 END) >= 5
                THEN now() + interval '15 minutes'
            ELSE confirmation_locked_until
        END
    WHERE id = p_identity_id;
$$;
REVOKE ALL ON FUNCTION public.register_admin_confirmation_failure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_admin_confirmation_failure(UUID) TO service_role;

ALTER TABLE public.admin_channel_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_whatsapp_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read own WhatsApp state" ON public.admin_whatsapp_states;
CREATE POLICY "Admins read own WhatsApp state" ON public.admin_whatsapp_states
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.admin_channel_identities i
        WHERE i.id = channel_identity_id AND i.admin_user_id = auth.uid()
    ));
REVOKE ALL ON public.admin_channel_link_challenges, public.admin_whatsapp_states, public.whatsapp_rate_limits FROM anon, authenticated;

-- Authenticated browser clients may read their own administrative state, but
-- every mutation must pass through the server-side authorization boundary.
DROP POLICY IF EXISTS "Admins manage activities" ON public.activities;
DROP POLICY IF EXISTS "Admins read all activities" ON public.activities;
CREATE POLICY "Admins read all activities" ON public.activities FOR SELECT TO authenticated
    USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins manage schedules" ON public.activity_schedules;
DROP POLICY IF EXISTS "Admins read all schedules" ON public.activity_schedules;
CREATE POLICY "Admins read all schedules" ON public.activity_schedules FOR SELECT TO authenticated
    USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins manage change requests" ON public.activity_change_requests;
DROP POLICY IF EXISTS "Admins read own change requests" ON public.activity_change_requests;
CREATE POLICY "Admins read own change requests" ON public.activity_change_requests FOR SELECT TO authenticated
    USING (actor_user_id = auth.uid() AND public.is_admin_user());
DROP POLICY IF EXISTS "Admins manage own channel identities" ON public.admin_channel_identities;
DROP POLICY IF EXISTS "Admins read own channel identities" ON public.admin_channel_identities;
CREATE POLICY "Admins read own channel identities" ON public.admin_channel_identities FOR SELECT TO authenticated
    USING (admin_user_id = auth.uid() AND public.is_admin_user());

-- Atomically claims and applies an already validated, single-activity change.
-- Only the service role may call this function. The application remains
-- responsible for role/MFA checks before invoking it.
CREATE OR REPLACE FUNCTION public.execute_activity_change(
    p_request_id UUID,
    p_actor_email TEXT,
    p_channel_identity_id UUID DEFAULT NULL,
    p_nonce_hash TEXT DEFAULT NULL,
    p_approval_method TEXT DEFAULT 'web_token'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.activity_change_requests%ROWTYPE;
    v_activity public.activities%ROWTYPE;
    v_changes JSONB;
    v_branch_id UUID;
    v_schedule JSONB;
    v_title TEXT;
BEGIN
    UPDATE public.activity_change_requests
    SET status = 'processing', confirmation_attempts = confirmation_attempts + 1
    WHERE id = p_request_id
      AND actor_email = p_actor_email
      AND status = 'pending'
      AND expires_at > now()
      AND approval_method = p_approval_method
      AND (p_channel_identity_id IS NULL OR channel_identity_id = p_channel_identity_id)
      AND (p_nonce_hash IS NULL OR nonce_hash = p_nonce_hash)
    RETURNING * INTO v_request;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'change_request_not_available' USING ERRCODE = 'P0001';
    END IF;

    v_changes := v_request.proposed_changes;
    IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_changes) AS key
        WHERE key NOT IN (
            'title_he','description_he','category_id','target_age_group','min_age','max_age',
            'days_of_week','start_time','end_time','start_date','end_date','price',
            'instructor_name','location','branch_id','venue','group_name','contact_name',
            'contact_phone','contact_email','notes','min_grade','max_grade','extra_data',
            'max_participants','current_participants','is_active','schedules'
        )
    ) THEN
        RAISE EXCEPTION 'unsupported_activity_field' USING ERRCODE = 'P0001';
    END IF;

    IF v_request.operation = 'create_draft' THEN
        v_title := NULLIF(trim(v_changes->>'title_he'), '');
        IF v_title IS NULL THEN RAISE EXCEPTION 'activity_title_required' USING ERRCODE = 'P0001'; END IF;
        IF NULLIF(trim(v_changes->>'location'), '') IS NOT NULL THEN
            INSERT INTO public.branches(name) VALUES (trim(v_changes->>'location'))
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_branch_id;
        ELSE
            v_branch_id := NULLIF(v_changes->>'branch_id','')::UUID;
        END IF;
        INSERT INTO public.activities (
            title,title_he,description,description_he,category_id,target_age_group,min_age,max_age,
            days_of_week,start_time,end_time,start_date,end_date,price,instructor_name,location,
            branch_id,venue,group_name,contact_name,contact_phone,contact_email,notes,min_grade,max_grade,
            extra_data,max_participants,current_participants,is_active,publication_status,updated_at
        ) VALUES (
            v_title,v_title,v_changes->>'description_he',v_changes->>'description_he',NULLIF(v_changes->>'category_id','')::UUID,
            v_changes->>'target_age_group',NULLIF(v_changes->>'min_age','')::INT,NULLIF(v_changes->>'max_age','')::INT,
            v_changes->>'days_of_week',NULLIF(v_changes->>'start_time','')::TIME,NULLIF(v_changes->>'end_time','')::TIME,
            NULLIF(v_changes->>'start_date','')::DATE,NULLIF(v_changes->>'end_date','')::DATE,NULLIF(v_changes->>'price','')::NUMERIC,
            v_changes->>'instructor_name',v_changes->>'location',v_branch_id,v_changes->>'venue',v_changes->>'group_name',
            v_changes->>'contact_name',v_changes->>'contact_phone',v_changes->>'contact_email',v_changes->>'notes',
            NULLIF(v_changes->>'min_grade','')::INT,NULLIF(v_changes->>'max_grade','')::INT,COALESCE(v_changes->'extra_data','{}'::jsonb),
            NULLIF(v_changes->>'max_participants','')::INT,COALESCE(NULLIF(v_changes->>'current_participants','')::INT,0),
            false,'draft',now()
        ) RETURNING * INTO v_activity;
    ELSE
        SELECT * INTO v_activity FROM public.activities WHERE id = v_request.activity_id FOR UPDATE;
        IF v_activity.id IS NULL THEN RAISE EXCEPTION 'activity_not_found' USING ERRCODE = 'P0001'; END IF;
        IF v_request.expected_updated_at IS NOT NULL AND v_activity.updated_at IS DISTINCT FROM v_request.expected_updated_at THEN
            UPDATE public.activity_change_requests SET status = 'stale' WHERE id = v_request.id;
            RAISE EXCEPTION 'activity_changed' USING ERRCODE = 'P0001';
        END IF;

        IF v_request.operation = 'publish' THEN
            IF NULLIF(trim(v_activity.title_he), '') IS NULL OR v_activity.branch_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM public.activity_schedules s WHERE s.activity_id = v_activity.id AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL AND s.start_time < s.end_time)
               OR NOT (v_activity.target_age_group IS NOT NULL OR (v_activity.min_age IS NOT NULL AND v_activity.max_age IS NOT NULL)) THEN
                RAISE EXCEPTION 'activity_incomplete_for_publish' USING ERRCODE = 'P0001';
            END IF;
            UPDATE public.activities SET publication_status='approved',is_active=true,archived_at=NULL,approved_at=now(),approved_by=v_request.actor_user_id,updated_at=now()
            WHERE id=v_activity.id RETURNING * INTO v_activity;
        ELSIF v_request.operation = 'archive' THEN
            UPDATE public.activities SET publication_status='archived',is_active=false,archived_at=now(),updated_at=now()
            WHERE id=v_activity.id RETURNING * INTO v_activity;
        ELSIF v_request.operation = 'restore' THEN
            UPDATE public.activities SET publication_status='draft',is_active=false,archived_at=NULL,updated_at=now()
            WHERE id=v_activity.id RETURNING * INTO v_activity;
        ELSE
            IF NULLIF(trim(v_changes->>'location'), '') IS NOT NULL THEN
                INSERT INTO public.branches(name) VALUES (trim(v_changes->>'location'))
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_branch_id;
            END IF;
            UPDATE public.activities SET
                title_he=CASE WHEN v_changes ? 'title_he' THEN v_changes->>'title_he' ELSE title_he END,
                title=CASE WHEN v_changes ? 'title_he' THEN v_changes->>'title_he' ELSE title END,
                description_he=CASE WHEN v_changes ? 'description_he' THEN v_changes->>'description_he' ELSE description_he END,
                description=CASE WHEN v_changes ? 'description_he' THEN v_changes->>'description_he' ELSE description END,
                category_id=CASE WHEN v_changes ? 'category_id' THEN NULLIF(v_changes->>'category_id','')::UUID ELSE category_id END,
                target_age_group=CASE WHEN v_changes ? 'target_age_group' THEN v_changes->>'target_age_group' ELSE target_age_group END,
                min_age=CASE WHEN v_changes ? 'min_age' THEN NULLIF(v_changes->>'min_age','')::INT ELSE min_age END,
                max_age=CASE WHEN v_changes ? 'max_age' THEN NULLIF(v_changes->>'max_age','')::INT ELSE max_age END,
                days_of_week=CASE WHEN v_changes ? 'days_of_week' THEN v_changes->>'days_of_week' ELSE days_of_week END,
                start_time=CASE WHEN v_changes ? 'start_time' THEN NULLIF(v_changes->>'start_time','')::TIME ELSE start_time END,
                end_time=CASE WHEN v_changes ? 'end_time' THEN NULLIF(v_changes->>'end_time','')::TIME ELSE end_time END,
                price=CASE WHEN v_changes ? 'price' THEN NULLIF(v_changes->>'price','')::NUMERIC ELSE price END,
                instructor_name=CASE WHEN v_changes ? 'instructor_name' THEN v_changes->>'instructor_name' ELSE instructor_name END,
                location=CASE WHEN v_changes ? 'location' THEN v_changes->>'location' ELSE location END,
                branch_id=CASE WHEN v_changes ? 'location' THEN v_branch_id WHEN v_changes ? 'branch_id' THEN NULLIF(v_changes->>'branch_id','')::UUID ELSE branch_id END,
                venue=CASE WHEN v_changes ? 'venue' THEN v_changes->>'venue' ELSE venue END,
                group_name=CASE WHEN v_changes ? 'group_name' THEN v_changes->>'group_name' ELSE group_name END,
                contact_name=CASE WHEN v_changes ? 'contact_name' THEN v_changes->>'contact_name' ELSE contact_name END,
                contact_phone=CASE WHEN v_changes ? 'contact_phone' THEN v_changes->>'contact_phone' ELSE contact_phone END,
                contact_email=CASE WHEN v_changes ? 'contact_email' THEN v_changes->>'contact_email' ELSE contact_email END,
                notes=CASE WHEN v_changes ? 'notes' THEN v_changes->>'notes' ELSE notes END,
                min_grade=CASE WHEN v_changes ? 'min_grade' THEN NULLIF(v_changes->>'min_grade','')::INT ELSE min_grade END,
                max_grade=CASE WHEN v_changes ? 'max_grade' THEN NULLIF(v_changes->>'max_grade','')::INT ELSE max_grade END,
                max_participants=CASE WHEN v_changes ? 'max_participants' THEN NULLIF(v_changes->>'max_participants','')::INT ELSE max_participants END,
                updated_at=now()
            WHERE id=v_activity.id RETURNING * INTO v_activity;
        END IF;
    END IF;

    IF v_changes ? 'schedules' THEN
        DELETE FROM public.activity_schedules WHERE activity_id=v_activity.id;
        FOR v_schedule IN SELECT value FROM jsonb_array_elements(v_changes->'schedules') LOOP
            INSERT INTO public.activity_schedules(activity_id,day_of_week,start_time,end_time)
            VALUES (v_activity.id,(v_schedule->>'day_of_week')::SMALLINT,NULLIF(v_schedule->>'start_time','')::TIME,NULLIF(v_schedule->>'end_time','')::TIME);
        END LOOP;
    END IF;

    UPDATE public.activity_change_requests
    SET status='confirmed',confirmed_at=now(),confirmed_by=v_request.actor_user_id
    WHERE id=v_request.id;
    INSERT INTO public.admin_audit_logs(actor_user_id,actor_email,action,resource_type,resource_id,metadata)
    VALUES (
        v_request.actor_user_id,v_request.actor_email,'activity.' || v_request.operation || '.confirmed',
        'activity',v_activity.id::TEXT,
        jsonb_build_object('requestId',v_request.id,'before',v_request.before_snapshot,'after',to_jsonb(v_activity),'approvalMethod',v_request.approval_method)
    );
    RETURN jsonb_build_object('requestId',v_request.id,'result',to_jsonb(v_activity));
EXCEPTION WHEN OTHERS THEN
    IF v_request.id IS NOT NULL THEN
        UPDATE public.activity_change_requests SET status=CASE WHEN SQLERRM='activity_changed' THEN 'stale' ELSE 'failed' END WHERE id=v_request.id;
        INSERT INTO public.admin_audit_logs(actor_user_id,actor_email,action,resource_type,resource_id,metadata)
        VALUES (v_request.actor_user_id,v_request.actor_email,'activity.change.failed','activity_change_request',v_request.id::TEXT,jsonb_build_object('operation',v_request.operation));
    END IF;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_activity_change(UUID,TEXT,UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_activity_change(UUID,TEXT,UUID,TEXT,TEXT) TO service_role;
