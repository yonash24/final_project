-- Forward-only security and concurrency hardening for WhatsApp MVP.

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'members', 'admin_users', 'registrations', 'import_jobs', 'import_rows',
        'notification_settings', 'notification_templates', 'notification_deliveries',
        'whatsapp_conversations', 'whatsapp_messages', 'whatsapp_message_events',
        'chat_sessions'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        FOR policy_name IN
            SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
        END LOOP;
    END LOOP;
END $$;

-- Public clients only need to read public catalogue/content data.
DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['categories', 'activities', 'events', 'posts', 'marketing_assets'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        FOR policy_name IN
            SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
        END LOOP;
    END LOOP;
END $$;

CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read activities" ON public.activities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read posts" ON public.posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage marketing_assets" ON public.marketing_assets FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- All listed operational tables are server-role-only; authenticated admin access
-- remains available through the existing server-side admin routes.
CREATE POLICY "Admins manage members" ON public.members FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Admins manage admin_users" ON public.admin_users FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DO $$
DECLARE table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'registrations', 'import_jobs', 'import_rows', 'notification_settings',
        'notification_templates', 'notification_deliveries', 'whatsapp_conversations',
        'whatsapp_messages', 'whatsapp_message_events', 'chat_sessions'
    ] LOOP
        EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))', table_name, table_name);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_message_events_provider_status_idx
    ON public.whatsapp_message_events(provider, provider_message_id, event_type, COALESCE(event_status, ''))
    WHERE provider_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_outbound_reply_inbound_idx
    ON public.whatsapp_messages(in_reply_to_message_id)
    WHERE direction = 'outbound' AND in_reply_to_message_id IS NOT NULL;
