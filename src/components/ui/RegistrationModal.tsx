'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CircleCheck as CheckCircle, Loader as Loader2, User, Phone, Mail, MessageSquare } from 'lucide-react';

interface Activity {
    id: string;
    title_he: string;
    price?: number | null;
    days_of_week?: string | null;
    start_time?: string | null;
    location?: string | null;
    max_participants?: number | null;
    current_participants?: number | null;
}

interface RegistrationModalProps {
    activity: Activity;
    onClose: () => void;
    onRegistered?: (result: { currentParticipants?: number | null; spotsLeft?: number | null }) => void;
}

type Step = 'form' | 'submitting' | 'success' | 'feedback';

export default function RegistrationModal({ activity, onClose, onRegistered }: RegistrationModalProps) {
    const [step, setStep] = useState<Step>('form');
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formStep, setFormStep] = useState<1 | 2>(1);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackSent, setFeedbackSent] = useState(false);

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

            const result = await res.json();
            onRegistered?.(result);
            setStep('success');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.';
            console.error('[Registration] Failed:', message);
            alert(message);
            setStep('form');
        }
    }

    function handleChange(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    function handleNextStep() {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = 'שדה חובה';
        if (!form.phone.trim() || !/^[0-9\-+ ]{9,15}$/.test(form.phone.trim())) {
            newErrors.phone = 'מספר טלפון לא תקין';
        }
        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            setFormStep(2);
        }
    }

    // Block scroll while open
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    // Focus trap + Esc to close + restore focus
    const panelRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';

        const panel = panelRef.current;
        const focusableSelector = 'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])';
        const focusable = panel ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => !el.hasAttribute('disabled')) : [];
        const firstFocusable = focusable[0];
        const closeBtn = panel?.querySelector<HTMLElement>('.modal-close-btn');
        const target = closeBtn ?? firstFocusable;
        target?.focus();

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'Tab' && panel) {
                const currentFocusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => !el.hasAttribute('disabled'));
                if (currentFocusable.length === 0) return;
                const first = currentFocusable[0];
                const last = currentFocusable[currentFocusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="הרשמה לחוג">
            <div className="modal-panel animate-scale-in" onClick={stopPropagation} ref={panelRef}>

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
                                ההרשמה שלך נקלטה עבור {activity.title_he}.<br />אישור יישלח למספר {form.phone} לאחר הפעלת ערוץ ההתראות, ובינתיים נציגנו יצור קשר לאישור סופי תוך 24 שעות.
                            </p>

                            {/* Feedback prompt */}
                            {!feedbackSent ? (
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>איך הייתה החוויה? 😊</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setFeedbackRating(star)}
                                                style={{
                                                    fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer',
                                                    opacity: star <= feedbackRating ? 1 : 0.3,
                                                    transform: star <= feedbackRating ? 'scale(1.1)' : 'scale(1)',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                ⭐
                                            </button>
                                        ))}
                                    </div>
                                    {feedbackRating > 0 && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ width: '100%' }}
                                            onClick={() => {
                                                fetch('/api/feedback', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        activity_id: activity.id,
                                                        feedback_type: 'registration',
                                                        rating: feedbackRating,
                                                        user_name: form.name,
                                                        user_phone: form.phone,
                                                    }),
                                                }).catch(() => {});
                                                setFeedbackSent(true);
                                            }}
                                        >
                                            שלח דירוג
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--success-600)' }}>✅ תודה על המשוב!</p>
                            )}

                            <button className="btn btn-primary btn-md" onClick={onClose} style={{ marginTop: '1rem' }}>
                                סגור
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            <div className="modal-stepper">
                                <div className={`modal-step-chip ${formStep === 1 ? 'is-active' : 'is-complete'}`}>1. פרטים בסיסיים</div>
                                <div className={`modal-step-chip ${formStep === 2 ? 'is-active' : ''}`}>2. השלמה קצרה</div>
                            </div>

                            <p className="modal-step-text">
                                {formStep === 1
                                    ? 'נתחיל רק משם וטלפון, כדי שיהיה קל ומהיר.'
                                    : 'כאן אפשר להוסיף פרטים רק אם נוח לכם. אפשר גם לדלג ולשלוח.'}
                            </p>

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
                                {formStep === 2 && (
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
                                )}

                                {/* Notes */}
                                {formStep === 2 && (
                                    <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                                        <label htmlFor="reg-notes" className="modal-label">
                                            <MessageSquare size={14} /> הערות (אופציונלי)
                                        </label>
                                        <textarea
                                            id="reg-notes"
                                            className="modal-input modal-textarea"
                                            placeholder="כל מידע שחשוב לנו לדעת, או שאלה שתרצו שנחזור אליה..."
                                            value={form.notes}
                                            onChange={(e) => handleChange('notes', e.target.value)}
                                            disabled={step === 'submitting'}
                                            rows={3}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions-row">
                                {formStep === 2 && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-lg"
                                        style={{ flex: 1 }}
                                        onClick={() => setFormStep(1)}
                                        disabled={step === 'submitting'}
                                    >
                                        חזרה
                                    </button>
                                )}

                                {formStep === 1 ? (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-lg"
                                        style={{ width: '100%' }}
                                        onClick={handleNextStep}
                                    >
                                        להמשך קצר
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-lg"
                                        style={{ flex: 1 }}
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
                                )}
                            </div>

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
