-- Migration: notification settings/outbox infrastructure and usability support columns

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL UNIQUE DEFAULT 'whatsapp',
    provider TEXT NOT NULL DEFAULT 'mock-whatsapp',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    send_registration_confirmations BOOLEAN NOT NULL DEFAULT true,
    send_class_reminders BOOLEAN NOT NULL DEFAULT true,
    send_event_reminders BOOLEAN NOT NULL DEFAULT true,
    reminder_lead_hours INT NOT NULL DEFAULT 24,
    admin_contact_name TEXT,
    admin_contact_phone TEXT,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    label TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    body TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    provider TEXT NOT NULL DEFAULT 'mock-whatsapp',
    template_key TEXT REFERENCES public.notification_templates(template_key) ON DELETE SET NULL,
    recipient_name TEXT,
    recipient_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    rendered_body TEXT,
    related_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    related_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    related_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    provider_message_id TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage notification templates" ON public.notification_templates;
CREATE POLICY "Admins can manage notification templates" ON public.notification_templates
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Admins can manage notification deliveries" ON public.notification_deliveries
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

INSERT INTO public.notification_settings (
    channel,
    provider,
    is_enabled,
    send_registration_confirmations,
    send_class_reminders,
    send_event_reminders,
    reminder_lead_hours
)
VALUES (
    'whatsapp',
    'mock-whatsapp',
    true,
    true,
    true,
    true,
    24
)
ON CONFLICT (channel) DO NOTHING;

INSERT INTO public.notification_templates (
    template_key,
    channel,
    label,
    description,
    is_enabled,
    body,
    variables
)
VALUES
    (
        'registration_confirmation',
        'whatsapp',
        'אישור הרשמה',
        'נשלח מייד לאחר הרשמה לחוג או לפעילות.',
        true,
        'היי {{name}}, ההרשמה שלך ל"{{activity_title}}" התקבלה בהצלחה. {{schedule_text}} {{location_text}} נשמח לראותך!',
        '["name","activity_title","schedule_text","location_text"]'::jsonb
    ),
    (
        'class_reminder',
        'whatsapp',
        'תזכורת לחוג',
        'תזכורת לפני תחילת מפגש או פתיחת סדרת מפגשים.',
        true,
        'היי {{name}}, תזכורת ידידותית: "{{activity_title}}" מתחיל ב-{{start_at}}. {{location_text}} נתראה בקרוב!',
        '["name","activity_title","start_at","location_text"]'::jsonb
    ),
    (
        'event_reminder',
        'whatsapp',
        'תזכורת לאירוע',
        'תזכורת לפני אירוע קהילתי.',
        true,
        'היי {{name}}, רק מזכירים ש"{{event_title}}" מתקיים ב-{{start_at}}. {{location_text}} מחכים לך!',
        '["name","event_title","start_at","location_text"]'::jsonb
    )
ON CONFLICT (template_key) DO NOTHING;
