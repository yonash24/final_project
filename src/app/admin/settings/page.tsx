"use client";

import { Activity, Bell, MessageSquareText, Save, SendHorizontal, Smartphone, ToggleLeft } from 'lucide-react';
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type {
    AdminNotificationDelivery,
    AdminNotificationProviderStatus,
    AdminNotificationSettings,
    AdminNotificationTemplate,
} from '@/lib/admin/types';

interface SettingsResponse {
    settings: AdminNotificationSettings | null;
    templates: AdminNotificationTemplate[];
    recentDeliveries: AdminNotificationDelivery[];
    providerStatus: AdminNotificationProviderStatus[];
}

interface SettingsFormState {
    provider: AdminNotificationSettings['provider'];
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string;
    admin_contact_phone: string;
    provider_config: {
        twilio_from_number: string;
        meta_phone_number_id: string;
        meta_business_account_id: string;
        status_callback_url: string;
        test_recipient_phone: string;
    };
    templates: Array<{
        template_key: AdminNotificationTemplate['template_key'];
        label: string;
        description: string | null;
        is_enabled: boolean;
        body: string;
        variables: string[];
    }>;
}

function buildFormState(data: SettingsResponse): SettingsFormState {
    return {
        provider: data.settings?.provider ?? 'mock-whatsapp',
        is_enabled: data.settings?.is_enabled ?? true,
        send_registration_confirmations: data.settings?.send_registration_confirmations ?? true,
        send_class_reminders: data.settings?.send_class_reminders ?? true,
        send_event_reminders: data.settings?.send_event_reminders ?? true,
        reminder_lead_hours: data.settings?.reminder_lead_hours ?? 24,
        admin_contact_name: data.settings?.admin_contact_name ?? '',
        admin_contact_phone: data.settings?.admin_contact_phone ?? '',
        provider_config: {
            twilio_from_number: data.settings?.provider_config?.twilio_from_number ?? '',
            meta_phone_number_id: data.settings?.provider_config?.meta_phone_number_id ?? '',
            meta_business_account_id: data.settings?.provider_config?.meta_business_account_id ?? '',
            status_callback_url: data.settings?.provider_config?.status_callback_url ?? '',
            test_recipient_phone: data.settings?.provider_config?.test_recipient_phone ?? '',
        },
        templates: data.templates.map((template) => ({
            template_key: template.template_key,
            label: template.label,
            description: template.description,
            is_enabled: template.is_enabled,
            body: template.body,
            variables: template.variables,
        })),
    };
}

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [recentDeliveries, setRecentDeliveries] = useState<AdminNotificationDelivery[]>([]);
    const [providerStatus, setProviderStatus] = useState<AdminNotificationProviderStatus[]>([]);
    const [form, setForm] = useState<SettingsFormState | null>(null);
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        let ignore = false;

        void (async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/admin/notifications/settings');
                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Failed to load settings');

                if (!ignore) {
                    const typedData = data as SettingsResponse;
                    setRecentDeliveries(typedData.recentDeliveries);
                    setProviderStatus(typedData.providerStatus);
                    setForm(buildFormState(typedData));
                }
            } catch (error) {
                console.error('Failed to load settings', error);
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!form) return;

        setSaving(true);
        try {
            const response = await fetch('/api/admin/notifications/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: form.provider,
                    is_enabled: form.is_enabled,
                    send_registration_confirmations: form.send_registration_confirmations,
                    send_class_reminders: form.send_class_reminders,
                    send_event_reminders: form.send_event_reminders,
                    reminder_lead_hours: form.reminder_lead_hours,
                    admin_contact_name: form.admin_contact_name,
                    admin_contact_phone: form.admin_contact_phone,
                    provider_config: form.provider_config,
                    templates: form.templates.map((template) => ({
                        template_key: template.template_key,
                        is_enabled: template.is_enabled,
                        body: template.body,
                    })),
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save settings');

            const typedData = data as SettingsResponse;
            setRecentDeliveries(typedData.recentDeliveries);
            setProviderStatus(typedData.providerStatus);
            setForm(buildFormState(typedData));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירת ההגדרות';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSendTest() {
        if (!form?.provider_config.test_recipient_phone) {
            alert('יש להזין מספר טלפון לבדיקה');
            return;
        }

        setSendingTest(true);
        try {
            const response = await fetch('/api/admin/notifications/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientPhone: form.provider_config.test_recipient_phone,
                    templateKey: form.templates[0]?.template_key ?? 'registration_confirmation',
                    message: testMessage.trim() || undefined,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send test message');

            const typedData = data as SettingsResponse;
            setRecentDeliveries(typedData.recentDeliveries);
            setProviderStatus(typedData.providerStatus);
            setForm(buildFormState(typedData));
            setTestMessage('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשליחת הודעת בדיקה';
            alert(message);
        } finally {
            setSendingTest(false);
        }
    }

    if (loading || !form) {
        return (
            <div className="admin-root">
                <AdminNavbar />
                <main className="admin-container" id="main-content">
                    <div className="card admin-section-card" style={{ padding: '2rem', textAlign: 'center' }}>טוען הגדרות...</div>
                </main>
            </div>
        );
    }

    const activeProviderStatus = providerStatus.find((item) => item.provider === form.provider);

    return (
        <div className="admin-root">
            <AdminNavbar />
            <main className="admin-container" id="main-content">
                <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.5rem' }}>הגדרות מערכת ⚙️</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    ניהול תשתית התראות WhatsApp, חיבור ספק אמיתי, תבניות, בדיקות שליחה וסטטוס webhook.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Bell size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>התראות WhatsApp</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <Field label="ספק">
                                    <select className="input-field" value={form.provider} onChange={(event) => setForm((prev) => prev ? { ...prev, provider: event.target.value as SettingsFormState['provider'] } : prev)}>
                                        <option value="mock-whatsapp">Mock WhatsApp</option>
                                        <option value="twilio-whatsapp">Twilio WhatsApp</option>
                                        <option value="meta-cloud-api">Meta Cloud API</option>
                                    </select>
                                </Field>
                                <Field label="שעות לפני תזכורת">
                                    <input type="number" min={1} max={168} className="input-field" value={form.reminder_lead_hours} onChange={(event) => setForm((prev) => prev ? { ...prev, reminder_lead_hours: Number(event.target.value) } : prev)} />
                                </Field>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <Field label="איש קשר">
                                    <input className="input-field" value={form.admin_contact_name} onChange={(event) => setForm((prev) => prev ? { ...prev, admin_contact_name: event.target.value } : prev)} />
                                </Field>
                                <Field label="טלפון לניהול">
                                    <input className="input-field" value={form.admin_contact_phone} onChange={(event) => setForm((prev) => prev ? { ...prev, admin_contact_phone: event.target.value } : prev)} />
                                </Field>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <ToggleRow label="מערכת התראות פעילה" checked={form.is_enabled} onChange={(checked) => setForm((prev) => prev ? { ...prev, is_enabled: checked } : prev)} />
                                <ToggleRow label="אישורי הרשמה אוטומטיים" checked={form.send_registration_confirmations} onChange={(checked) => setForm((prev) => prev ? { ...prev, send_registration_confirmations: checked } : prev)} />
                                <ToggleRow label="תזכורות לחוגים" checked={form.send_class_reminders} onChange={(checked) => setForm((prev) => prev ? { ...prev, send_class_reminders: checked } : prev)} />
                                <ToggleRow label="תזכורות לאירועים" checked={form.send_event_reminders} onChange={(checked) => setForm((prev) => prev ? { ...prev, send_event_reminders: checked } : prev)} />
                            </div>
                        </div>

                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Activity size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>הגדרות ספק</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <Field label="Twilio sender">
                                    <input className="input-field" placeholder="whatsapp:+14155238886" value={form.provider_config.twilio_from_number} onChange={(event) => updateProviderConfig(setForm, 'twilio_from_number', event.target.value)} />
                                </Field>
                                <Field label="Meta phone number ID">
                                    <input className="input-field" placeholder="123456789012345" value={form.provider_config.meta_phone_number_id} onChange={(event) => updateProviderConfig(setForm, 'meta_phone_number_id', event.target.value)} />
                                </Field>
                                <Field label="Meta business account ID">
                                    <input className="input-field" placeholder="987654321098765" value={form.provider_config.meta_business_account_id} onChange={(event) => updateProviderConfig(setForm, 'meta_business_account_id', event.target.value)} />
                                </Field>
                                <Field label="Status callback base URL">
                                    <input className="input-field" placeholder="https://example.com/api/webhooks/whatsapp" value={form.provider_config.status_callback_url} onChange={(event) => updateProviderConfig(setForm, 'status_callback_url', event.target.value)} />
                                </Field>
                            </div>
                        </div>

                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <MessageSquareText size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>תבניות הודעה</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {form.templates.map((template, index) => (
                                    <div key={template.template_key} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.6rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>{template.label}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{template.description}</div>
                                            </div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={template.is_enabled}
                                                    onChange={(event) => setForm((prev) => prev ? {
                                                        ...prev,
                                                        templates: prev.templates.map((item, itemIndex) => itemIndex === index ? { ...item, is_enabled: event.target.checked } : item),
                                                    } : prev)}
                                                />
                                                פעיל
                                            </label>
                                        </div>
                                        <textarea
                                            className="input-field"
                                            style={{ minHeight: '110px' }}
                                            value={template.body}
                                            onChange={(event) => setForm((prev) => prev ? {
                                                ...prev,
                                                templates: prev.templates.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item),
                                            } : prev)}
                                        />
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            משתנים זמינים: {template.variables.map((variable) => `{{${variable}}}`).join(', ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Smartphone size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>מצב הספק הפעיל</h2>
                            </div>
                            {activeProviderStatus ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <StatusBadge status={activeProviderStatus.isConfigured}>
                                        {activeProviderStatus.isConfigured ? 'מוכן לשליחה' : 'חסר קונפיגורציה'}
                                    </StatusBadge>
                                    {activeProviderStatus.requiredEnvVars.map((entry) => (
                                        <div key={entry.name} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
                                                <strong>{entry.name}</strong>
                                                <span style={{ color: entry.present ? 'var(--success-600)' : 'var(--warning-600)', fontWeight: 700 }}>
                                                    {entry.present ? 'Configured' : 'Missing'}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{entry.description}</div>
                                        </div>
                                    ))}
                                    {activeProviderStatus.warnings.map((warning) => (
                                        <div key={warning} style={{ backgroundColor: 'var(--warning-50)', border: '1px solid var(--warning-200)', color: 'var(--warning-700)', borderRadius: 'var(--radius-md)', padding: '0.85rem', fontSize: '0.85rem' }}>
                                            {warning}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <SendHorizontal size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>שליחת בדיקה</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                <Field label="מספר יעד לבדיקה">
                                    <input className="input-field" placeholder="+972501234567" value={form.provider_config.test_recipient_phone} onChange={(event) => updateProviderConfig(setForm, 'test_recipient_phone', event.target.value)} />
                                </Field>
                                <Field label="טקסט מותאם אישית (אופציונלי)">
                                    <textarea className="input-field" style={{ minHeight: '90px' }} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="אם תשאירו ריק, תישלח תבנית ברירת מחדל לבדיקה." />
                                </Field>
                                <button type="button" onClick={handleSendTest} disabled={sendingTest} className="btn btn-secondary btn-md" style={{ justifyContent: 'center' }}>
                                    <SendHorizontal size={18} /> {sendingTest ? 'שולח...' : 'שלח הודעת בדיקה'}
                                </button>
                            </div>
                        </div>

                        <div className="card admin-section-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <ToggleLeft size={20} color="var(--primary-600)" />
                                <h2 style={{ fontSize: '1.35rem' }}>הודעות אחרונות</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                {recentDeliveries.length === 0 ? (
                                    <div style={{ color: 'var(--text-secondary)' }}>עדיין לא נוצרו הודעות.</div>
                                ) : recentDeliveries.map((delivery) => (
                                    <div key={delivery.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                                            <strong>{delivery.template_key ?? 'manual'}</strong>
                                            <span style={{ color: getStatusColor(delivery.status), fontWeight: 700 }}>{delivery.status}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            {delivery.recipient_name || 'ללא שם'} • {delivery.recipient_phone}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                                            ניסיונות: {delivery.attempts_count} • {new Date(delivery.created_at).toLocaleString('he-IL')}
                                        </div>
                                        {delivery.error_message ? (
                                            <div style={{ color: 'var(--error-700)', fontSize: '0.8rem', marginTop: '0.45rem' }}>{delivery.error_message}</div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button type="submit" disabled={saving} className="btn btn-primary btn-md" style={{ justifyContent: 'center' }}>
                            <Save size={18} /> {saving ? 'שומר הגדרות...' : 'שמור שינויים'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

function updateProviderConfig(
    setForm: Dispatch<SetStateAction<SettingsFormState | null>>,
    key: keyof SettingsFormState['provider_config'],
    value: string,
) {
    setForm((prev) => prev ? {
        ...prev,
        provider_config: {
            ...prev.provider_config,
            [key]: value,
        },
    } : prev);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{label}</label>
            {children}
        </div>
    );
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 700 }}>{label}</span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        </label>
    );
}

function StatusBadge({ status, children }: { status: boolean; children: ReactNode }) {
    return (
        <div style={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            padding: '0.35rem 0.8rem',
            backgroundColor: status ? 'var(--success-50)' : 'var(--warning-100)',
            color: status ? 'var(--success-700)' : 'var(--warning-700)',
            fontWeight: 800,
            fontSize: '0.85rem',
        }}>
            {children}
        </div>
    );
}

function getStatusColor(status: AdminNotificationDelivery['status']) {
    switch (status) {
        case 'failed':
            return 'var(--error-600)';
        case 'pending':
        case 'retrying':
        case 'processing':
            return 'var(--warning-600)';
        case 'suppressed':
            return 'var(--neutral-600)';
        default:
            return 'var(--success-600)';
    }
}
