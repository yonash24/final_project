-- Open access migration
-- This removes the admin/auth gate from the app-level data model so anonymous users can read and write the supported tables.

ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access categories" ON public.categories;
CREATE POLICY "Public full access categories" ON public.categories FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access activities" ON public.activities;
CREATE POLICY "Public full access activities" ON public.activities FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access events" ON public.events;
CREATE POLICY "Public full access events" ON public.events FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access members" ON public.members;
CREATE POLICY "Public full access members" ON public.members FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access posts" ON public.posts;
CREATE POLICY "Public full access posts" ON public.posts FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access registrations" ON public.registrations;
CREATE POLICY "Public full access registrations" ON public.registrations FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access marketing_assets" ON public.marketing_assets;
CREATE POLICY "Public full access marketing_assets" ON public.marketing_assets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access chat_sessions" ON public.chat_sessions;
CREATE POLICY "Public full access chat_sessions" ON public.chat_sessions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access admin_users" ON public.admin_users;
CREATE POLICY "Public full access admin_users" ON public.admin_users FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access import_jobs" ON public.import_jobs;
CREATE POLICY "Public full access import_jobs" ON public.import_jobs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access import_rows" ON public.import_rows;
CREATE POLICY "Public full access import_rows" ON public.import_rows FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access notification_settings" ON public.notification_settings;
CREATE POLICY "Public full access notification_settings" ON public.notification_settings FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access notification_templates" ON public.notification_templates;
CREATE POLICY "Public full access notification_templates" ON public.notification_templates FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access notification_deliveries" ON public.notification_deliveries;
CREATE POLICY "Public full access notification_deliveries" ON public.notification_deliveries FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Public full access whatsapp_conversations" ON public.whatsapp_conversations FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Public full access whatsapp_messages" ON public.whatsapp_messages FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access whatsapp_message_events" ON public.whatsapp_message_events;
CREATE POLICY "Public full access whatsapp_message_events" ON public.whatsapp_message_events FOR ALL TO public USING (true) WITH CHECK (true);
