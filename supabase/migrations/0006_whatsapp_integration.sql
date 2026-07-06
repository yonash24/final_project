-- Migration: production-ready WhatsApp integration with conversations, events, and retry metadata

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_status TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_source TEXT;

ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS provider_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notification_deliveries
ADD COLUMN IF NOT EXISTS related_conversation_id UUID,
ADD COLUMN IF NOT EXISTS attempts_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error_code TEXT,
ADD COLUMN IF NOT EXISTS provider_response JSONB,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'mock-whatsapp',
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    opt_in_status TEXT NOT NULL DEFAULT 'unknown',
    last_inbound_at TIMESTAMPTZ,
    last_outbound_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_provider_phone_idx
    ON public.whatsapp_conversations(provider, contact_phone);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'mock-whatsapp',
    direction TEXT NOT NULL,
    message_kind TEXT NOT NULL DEFAULT 'text',
    body TEXT,
    provider_message_id TEXT,
    in_reply_to_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
    delivery_id UUID REFERENCES public.notification_deliveries(id) ON DELETE SET NULL,
    chat_response JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_message_idx
    ON public.whatsapp_messages(provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_idx
    ON public.whatsapp_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.notification_deliveries(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'mock-whatsapp',
    event_type TEXT NOT NULL,
    event_status TEXT,
    provider_message_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_message_events_message_idx
    ON public.whatsapp_message_events(message_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_message_events_provider_message_idx
    ON public.whatsapp_message_events(provider_message_id)
    WHERE provider_message_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notification_deliveries_related_conversation_id_fkey'
    ) THEN
        ALTER TABLE public.notification_deliveries
        ADD CONSTRAINT notification_deliveries_related_conversation_id_fkey
        FOREIGN KEY (related_conversation_id)
        REFERENCES public.whatsapp_conversations(id)
        ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage whatsapp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Admins can manage whatsapp conversations" ON public.whatsapp_conversations
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can manage whatsapp messages" ON public.whatsapp_messages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage whatsapp message events" ON public.whatsapp_message_events;
CREATE POLICY "Admins can manage whatsapp message events" ON public.whatsapp_message_events
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

INSERT INTO public.notification_templates (
    template_key,
    channel,
    label,
    description,
    is_enabled,
    body,
    variables
)
VALUES (
    'change_notification',
    'whatsapp',
    'עדכון או ביטול פעילות',
    'תשתית להודעות על שינוי, דחייה או ביטול של חוג/אירוע.',
    true,
    'היי {{name}}, עדכון לגבי "{{subject}}": {{change_summary}} לשאלות אפשר לפנות אל {{contact_name}} {{contact_phone}}.',
    '["name","subject","change_summary","contact_name","contact_phone"]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;
