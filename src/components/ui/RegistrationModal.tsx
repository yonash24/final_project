'use client';

import { useState } from 'react';
import { X, CheckCircle, Loader2, User, Phone, Mail, MessageSquare } from 'lucide-react';

interface Activity {
    id: string;
    title_he: string;
    price?: number | null;
    days_of_week?: string | null;
    start_time?: string | null;
    location?: string | null;
}

interface RegistrationModalProps {
    activity: Activity;
    onClose: () => void;
}

type Step = 'form' | 'submitting' | 'success';

export default function RegistrationModal({ activity, onClose }: RegistrationModalProps) {
    const [step, setStep] = useState<Step>('form');
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});

    function validate() {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = 'שדה חובה';
        if (!form.phone.trim() || !/^[0-9\-+ ]{9,15}$/.test(form.phone.trim()))
            newErrors.phone = 'מספר טלפון לא תקין';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            newErrors.email = 'כתובת אימייל לא תקינה';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setStep('submitting');

        try {
            const res = await fetch('/api/registrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity_id: activity.id,
                    full_name: form.name,
                    phone: form.phone,
                    email: form.email,
                    notes: form.notes,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to register');
            }

            setStep('success');
        } catch (err: any) {
            console.error('[Registration] Failed:', err.message);
            alert(err.message || 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.');
            setStep('form');
        }
    }

    function handleChange(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    // Block scroll while open
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="הרשמה לחוג">
            <div className="modal-panel animate-fade-up" onClick={stopPropagation}>

                {/* ── Header ── */}
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">הרשמה לחוג</h2>
                        <div className="modal-subtitle">{activity.title_he}</div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="סגור">
                        <X size={20} />
                    </button>
                </div>

                {/* ── Summary strip ── */}
                {(activity.days_of_week || activity.location || activity.price != null) && (
                    <div className="modal-summary">
                        {activity.days_of_week && (
                            <span>📅 {activity.days_of_week}{activity.start_time ? ` ${activity.start_time.slice(0, 5)}` : ''}</span>
                        )}
                        {activity.location && <span>📍 {activity.location}</span>}
                        {activity.price != null && (
                            <span>💰 {activity.price === 0 ? 'חינם' : `₪${activity.price}/חודש`}</span>
                        )}
                    </div>
                )}

                {/* ── Body ── */}
                <div className="modal-body">
                    {step === 'success' ? (
                        <div className="modal-success">
                            <div className="modal-success-icon">
                                <CheckCircle size={48} />
                            </div>
                            <h3>הרשמה התקבלה! 🎉</h3>
                            <p>
                                שלחנו אישור לטלפון {form.phone}.
                                <br />
                                נציגנו יצור איתך קשר לאישור סופי תוך 24 שעות.
                            </p>
                            <button className="btn btn-primary btn-md" onClick={onClose} style={{ marginTop: '1.5rem' }}>
                                סגור
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            <div className="modal-form-grid">
                                {/* Full name */}
                                <div className="modal-field">
                                    <label htmlFor="reg-name" className="modal-label">
                                        <User size={14} /> שם מלא *
                                    </label>
                                    <input
                                        id="reg-name"
                                        type="text"
                                        className={`modal-input ${errors.name ? 'modal-input-error' : ''}`}
                                        placeholder="ישראל ישראלי"
                                        value={form.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        disabled={step === 'submitting'}
                                        autoComplete="name"
                                    />
                                    {errors.name && <span className="modal-error">{errors.name}</span>}
                                </div>

                                {/* Phone */}
                                <div className="modal-field">
                                    <label htmlFor="reg-phone" className="modal-label">
                                        <Phone size={14} /> טלפון *
                                    </label>
                                    <input
                                        id="reg-phone"
                                        type="tel"
                                        className={`modal-input ${errors.phone ? 'modal-input-error' : ''}`}
                                        placeholder="050-000-0000"
                                        value={form.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        disabled={step === 'submitting'}
                                        autoComplete="tel"
                                    />
                                    {errors.phone && <span className="modal-error">{errors.phone}</span>}
                                </div>

                                {/* Email */}
                                <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="reg-email" className="modal-label">
                                        <Mail size={14} /> אימייל (אופציונלי)
                                    </label>
                                    <input
                                        id="reg-email"
                                        type="email"
                                        className={`modal-input ${errors.email ? 'modal-input-error' : ''}`}
                                        placeholder="israel@example.com"
                                        value={form.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        disabled={step === 'submitting'}
                                        autoComplete="email"
                                    />
                                    {errors.email && <span className="modal-error">{errors.email}</span>}
                                </div>

                                {/* Notes */}
                                <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="reg-notes" className="modal-label">
                                        <MessageSquare size={14} /> הערות (אופציונלי)
                                    </label>
                                    <textarea
                                        id="reg-notes"
                                        className="modal-input modal-textarea"
                                        placeholder="כל מידע שחשוב לנו לדעת..."
                                        value={form.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        disabled={step === 'submitting'}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: '1.5rem' }}
                                disabled={step === 'submitting'}
                                id="modal-submit-button"
                            >
                                {step === 'submitting' ? (
                                    <>
                                        <Loader2 size={18} className="activity-spinner" />
                                        שולח...
                                    </>
                                ) : (
                                    '✍️ שלח הרשמה'
                                )}
                            </button>

                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.75rem' }}>
                                פרטיך מאובטחים ולא יועברו לצדדים שלישיים
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
