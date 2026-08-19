-- Security, audit, chat metrics, and cache infrastructure.

ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE public.admin_users
SET role = 'super_admin'
WHERE role IS NULL OR role = 'admin';

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = auth.uid() AND is_active = true
    );
$$;

REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.members FROM anon;
REVOKE ALL ON public.import_jobs FROM anon;
REVOKE ALL ON public.import_rows FROM anon;
REVOKE ALL ON public.notification_settings FROM anon;
REVOKE ALL ON public.notification_templates FROM anon;
REVOKE ALL ON public.notification_deliveries FROM anon;
REVOKE ALL ON public.whatsapp_conversations FROM anon;
REVOKE ALL ON public.whatsapp_messages FROM anon;
REVOKE ALL ON public.whatsapp_message_events FROM anon;

DROP POLICY IF EXISTS "Public full access categories" ON public.categories;
DROP POLICY IF EXISTS "Public full access activities" ON public.activities;
DROP POLICY IF EXISTS "Public full access events" ON public.events;
DROP POLICY IF EXISTS "Public full access posts" ON public.posts;
DROP POLICY IF EXISTS "Public full access marketing_assets" ON public.marketing_assets;

DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Public read activities" ON public.activities;
DROP POLICY IF EXISTS "Public read events" ON public.events;
DROP POLICY IF EXISTS "Public read posts" ON public.posts;
DROP POLICY IF EXISTS "Public read marketing assets" ON public.marketing_assets;
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
DROP POLICY IF EXISTS "Admins manage activities" ON public.activities;
DROP POLICY IF EXISTS "Admins manage events" ON public.events;
DROP POLICY IF EXISTS "Admins manage posts" ON public.posts;
DROP POLICY IF EXISTS "Admins manage marketing assets" ON public.marketing_assets;
DROP POLICY IF EXISTS "Admins manage members" ON public.members;
DROP POLICY IF EXISTS "Admins manage import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Admins manage import rows" ON public.import_rows;
DROP POLICY IF EXISTS "Admins manage notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins manage notification templates" ON public.notification_templates;
DROP POLICY IF EXISTS "Admins manage notification deliveries" ON public.notification_deliveries;
DROP POLICY IF EXISTS "Admins manage whatsapp conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Admins manage whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins manage whatsapp events" ON public.whatsapp_message_events;

REVOKE INSERT, UPDATE, DELETE ON public.categories, public.activities, public.events, public.posts, public.marketing_assets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.categories, public.activities, public.events, public.posts, public.marketing_assets FROM authenticated;

CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Public read activities" ON public.activities FOR SELECT TO public USING (true);
CREATE POLICY "Public read events" ON public.events FOR SELECT TO public USING (true);
CREATE POLICY "Public read posts" ON public.posts FOR SELECT TO public USING (true);
CREATE POLICY "Public read marketing assets" ON public.marketing_assets FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage categories" ON public.categories
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage activities" ON public.activities
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage events" ON public.events
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage posts" ON public.posts
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage marketing assets" ON public.marketing_assets
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Public manage chat query logs" ON public.chat_query_logs;
REVOKE ALL ON public.chat_query_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "Public full access admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Public full access members" ON public.members;
DROP POLICY IF EXISTS "Public full access import_jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Public full access import_rows" ON public.import_rows;
DROP POLICY IF EXISTS "Public full access notification_settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Public full access notification_templates" ON public.notification_templates;
DROP POLICY IF EXISTS "Public full access notification_deliveries" ON public.notification_deliveries;
DROP POLICY IF EXISTS "Public full access whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Public full access whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Public full access whatsapp_message_events" ON public.whatsapp_message_events;

CREATE POLICY "Admins can read own admin profile" ON public.admin_users
    FOR SELECT TO authenticated USING (id = auth.uid() AND is_active = true);
CREATE POLICY "Admins manage members" ON public.members
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage import jobs" ON public.import_jobs
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage import rows" ON public.import_rows
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage notification settings" ON public.notification_settings
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage notification templates" ON public.notification_templates
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage notification deliveries" ON public.notification_deliveries
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage whatsapp conversations" ON public.whatsapp_conversations
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage whatsapp messages" ON public.whatsapp_messages
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins manage whatsapp events" ON public.whatsapp_message_events
    FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_request_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    intent TEXT,
    response_type TEXT,
    total_duration_ms INTEGER,
    classification_duration_ms INTEGER,
    retrieval_duration_ms INTEGER,
    embedding_duration_ms INTEGER,
    generation_duration_ms INTEGER,
    result_count INTEGER NOT NULL DEFAULT 0,
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_type TEXT,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_response_cache (
    query_hash TEXT PRIMARY KEY,
    response_payload JSONB NOT NULL,
    model_version TEXT NOT NULL DEFAULT 'v1',
    knowledge_version TEXT NOT NULL DEFAULT 'v1',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.precompute_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    processed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precompute_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs
    FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "Admins read chat metrics" ON public.chat_request_metrics
    FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "Admins read precompute jobs" ON public.precompute_jobs
    FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON public.admin_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_resource_idx ON public.admin_audit_logs (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_request_metrics_created_idx ON public.chat_request_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_request_metrics_intent_idx ON public.chat_request_metrics (intent, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_response_cache_expiry_idx ON public.chat_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS precompute_jobs_status_idx ON public.precompute_jobs (status, created_at DESC);

REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;
REVOKE ALL ON public.chat_request_metrics FROM anon, authenticated;
REVOKE ALL ON public.chat_response_cache FROM anon, authenticated;
REVOKE ALL ON public.precompute_jobs FROM anon, authenticated;

-- Detailed metrics are disposable; aggregates in chat_query_logs remain durable.
CREATE OR REPLACE FUNCTION public.cleanup_chat_request_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM public.chat_request_metrics WHERE created_at < now() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
