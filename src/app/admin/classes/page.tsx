"use client";

import Link from 'next/link';
import { Plus, Trash2, X, Upload, Pencil, Users, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { AdminActivity } from '@/lib/admin/types';
import { supabase } from '@/lib/supabase/client';

interface CategoryOption {
    id: string;
    name_he: string;
}

interface ActivityFormState {
    title_he: string;
    description_he: string;
    category_id: string;
    target_age_group: string;
    instructor_name: string;
    schedules: Array<{ day_of_week: number; start_time: string; end_time: string }>;
    start_date: string;
    end_date: string;
    location: string;
    venue: string;
    group_name: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    notes: string;
    min_grade: string;
    max_grade: string;
    min_age: string;
    max_age: string;
    price: string;
    max_participants: string;
    is_active: boolean;
}

type PendingChange = {
    token: string;
    operation: 'create' | 'update' | 'archive';
    target: AdminActivity | null;
    changes: Record<string, unknown>;
};

const DAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const EMPTY_FORM: ActivityFormState = {
    title_he: '',
    description_he: '',
    category_id: '',
    target_age_group: '',
    instructor_name: '',
    schedules: [],
    start_date: '',
    end_date: '',
    location: '',
    venue: '',
    group_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
    min_grade: '',
    max_grade: '',
    min_age: '',
    max_age: '',
    price: '',
    max_participants: '',
    is_active: true,
};

function mapActivityToForm(activity: AdminActivity): ActivityFormState {
    const fallbackSchedules = (activity.days_of_week ?? '').split(/[,;/]+/)
        .map((day) => DAY_LABELS.indexOf(day.trim()))
        .filter((day) => day >= 0)
        .map((day_of_week) => ({
            day_of_week,
            start_time: activity.start_time?.slice(0, 5) ?? '',
            end_time: activity.end_time?.slice(0, 5) ?? '',
        }));
    return {
        title_he: activity.title_he ?? '',
        description_he: activity.description_he ?? '',
        category_id: activity.category_id ?? '',
        target_age_group: activity.target_age_group ?? '',
        instructor_name: activity.instructor_name ?? '',
        schedules: activity.activity_schedules?.map((schedule) => ({
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time?.slice(0, 5) ?? '',
            end_time: schedule.end_time?.slice(0, 5) ?? '',
        })) ?? fallbackSchedules,
        start_date: activity.start_date ?? '',
        end_date: activity.end_date ?? '',
        location: activity.location ?? '',
        venue: activity.venue ?? '',
        group_name: activity.group_name ?? '',
        contact_name: activity.contact_name ?? '',
        contact_phone: activity.contact_phone ?? '',
        contact_email: activity.contact_email ?? '',
        notes: activity.notes ?? '',
        min_grade: activity.min_grade?.toString() ?? '',
        max_grade: activity.max_grade?.toString() ?? '',
        min_age: activity.min_age?.toString() ?? '',
        max_age: activity.max_age?.toString() ?? '',
        price: activity.price?.toString() ?? '',
        max_participants: activity.max_participants?.toString() ?? '',
        is_active: activity.is_active,
    };
}

export default function AdminClassesPage() {
    const [classes, setClasses] = useState<AdminActivity[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingClass, setEditingClass] = useState<AdminActivity | null>(null);
    const [form, setForm] = useState<ActivityFormState>(EMPTY_FORM);
    const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

    async function loadClasses() {
        const response = await fetch('/api/admin/activities');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch activities');
        return data as AdminActivity[];
    }

    async function loadCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name_he')
            .order('name_he', { ascending: true });

        if (error) throw error;
        // Older imports could create the same category more than once. Keep the
        // dropdown usable even before the database cleanup migration is applied.
        const seenNames = new Set<string>();
        return (data ?? []).filter((category) => {
            const key = category.name_he.trim().toLocaleLowerCase();
            if (!key || seenNames.has(key)) return false;
            seenNames.add(key);
            return true;
        }) as CategoryOption[];
    }

    async function refreshData() {
        setLoading(true);
        try {
            const [activityData, categoryData] = await Promise.all([loadClasses(), loadCategories()]);
            setClasses(activityData);
            setCategories(categoryData);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let ignore = false;

        void (async () => {
            setLoading(true);
            try {
                const [activityData, categoryData] = await Promise.all([loadClasses(), loadCategories()]);
                if (!ignore) {
                    setClasses(activityData);
                    setCategories(categoryData);
                }
            } catch (error) {
                console.error('Fetch error:', error);
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

    function openCreateModal() {
        setEditingClass(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    }

    function openEditModal(activity: AdminActivity) {
        setEditingClass(activity);
        setForm(mapActivityToForm(activity));
        setShowModal(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);

        try {
            const response = await fetch(
                editingClass ? `/api/admin/activities/${editingClass.id}` : '/api/admin/activities',
                {
                    method: editingClass ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingClass ? { ...form, expected_updated_at: editingClass.updated_at } : form),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.formErrors?.join(', ') || data.error || 'Failed to save');
            }

            if (data.responseType !== 'confirmation' || !data.token) throw new Error('לא התקבלה בקשת אישור תקינה');
            setPendingChange(data as PendingChange);
            setShowModal(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירת החוג';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteClass(activity: AdminActivity) {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/activities/${activity.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expected_updated_at: activity.updated_at }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Delete failed');
            }
            const data = await response.json();
            if (data.responseType !== 'confirmation' || !data.token) throw new Error('לא התקבלה בקשת אישור תקינה');
            setPendingChange(data as PendingChange);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה במחיקה';
            alert(message);
        } finally {
            setLoading(false);
        }
    }

    async function confirmPendingChange() {
        if (!pendingChange || saving) return;
        setSaving(true);
        try {
            const response = await fetch('/api/admin/activity-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm', token: pendingChange.token }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'האישור נכשל');
            setPendingChange(null);
            setForm(EMPTY_FORM);
            setEditingClass(null);
            await refreshData();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'האישור נכשל');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="admin-root">
            <AdminNavbar />
            <main className="admin-container" id="main-content">
                <header className="admin-page-header">
                    <div>
                        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.5rem' }}>ניהול חוגים 📚</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>עריכה מהירה של פרטי חוג, זמינות משתתפים ותאריכי פתיחה.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <Link href="/admin/classes/import" className="btn btn-secondary btn-md">
                            <Upload size={18} /> ייבוא אקסל
                        </Link>
                        <button onClick={openCreateModal} className="btn btn-primary btn-md">
                            <Plus size={18} /> הוסף חוג חדש
                        </button>
                    </div>
                </header>

                <div className="card admin-section-card" style={{ padding: '1rem' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {classes.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    אין חוגים רשומים במערכת.
                                </div>
                            ) : classes.map((activity) => {
                                const capacity = activity.max_participants ?? 0;
                                const current = activity.current_participants ?? 0;
                                const spotsLeft = activity.max_participants == null ? null : Math.max(capacity - current, 0);

                                return (
                                    <div
                                        key={activity.id}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1.3fr 1fr auto',
                                            gap: '1rem',
                                            alignItems: 'center',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '1rem 1.25rem',
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                                <h3 style={{ fontSize: '1.1rem' }}>{activity.title_he}</h3>
                                                <span className="hero-badge" style={{ fontSize: '0.72rem' }}>
                                                    {activity.categories?.name_he ?? 'ללא קטגוריה'}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '999px',
                                                        backgroundColor: activity.is_active ? 'var(--success-50)' : 'var(--neutral-200)',
                                                        color: activity.is_active ? 'var(--success-700)' : 'var(--neutral-600)',
                                                    }}
                                                >
                                                    {activity.is_active ? 'פעיל' : 'מושהה'}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                {activity.instructor_name || 'ללא מדריך'} • {activity.location || 'מיקום טרם הוגדר'}
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                                {activity.days_of_week || 'ימים לא הוגדרו'}
                                                {activity.start_time ? ` • ${activity.start_time.slice(0, 5)}` : ''}
                                                {activity.start_date ? ` • פתיחה: ${new Date(activity.start_date).toLocaleDateString('he-IL')}` : ''}
                                            </div>
                                        </div>

                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                                <Users size={15} />
                                                {activity.max_participants == null
                                                    ? 'ללא מגבלת מקומות'
                                                    : `${current}/${capacity} רשומים`}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <CalendarDays size={15} />
                                                גיל {activity.min_age ?? '-'} עד {activity.max_age ?? '-'}
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.35rem' }}>
                                                {activity.price == null || activity.price === 0 ? 'חינם' : `₪${activity.price}`}
                                            </div>
                                            {spotsLeft != null && (
                                                <div
                                                    style={{
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        color: spotsLeft === 0 ? 'var(--error-600)' : spotsLeft < 5 ? 'var(--warning-600)' : 'var(--success-600)',
                                                    }}
                                                >
                                                    {spotsLeft === 0 ? 'אין מקומות פנויים' : `נותרו ${spotsLeft} מקומות`}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => openEditModal(activity)}
                                                title="ערוך חוג"
                                                style={{ backgroundColor: 'var(--primary-50)' }}
                                            >
                                                <Pencil size={16} color="var(--primary-600)" />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => deleteClass(activity)}
                                                style={{ backgroundColor: 'var(--error-100)' }}
                                                title="מחק חוג"
                                            >
                                                <Trash2 size={16} color="var(--error-600)" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(13,27,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '840px', padding: '2rem', backgroundColor: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <div>
                                <h2>{editingClass ? 'עריכת חוג' : 'הוספת חוג חדש'}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {editingClass ? 'עדכן את כל פרטי החוג במקום אחד.' : 'מלא את פרטי החוג כפי שיופיעו באתר ובאישור ההרשמה.'}
                                </p>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="סגור">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                                <input required className="input-field" placeholder="שם החוג" value={form.title_he} onChange={(event) => setForm((prev) => ({ ...prev, title_he: event.target.value }))} />
                                <select className="input-field" value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}>
                                    <option value="">בחר קטגוריה</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name_he}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '90px' }} value={form.description_he} onChange={(event) => setForm((prev) => ({ ...prev, description_he: event.target.value }))} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="שם המדריך" value={form.instructor_name} onChange={(event) => setForm((prev) => ({ ...prev, instructor_name: event.target.value }))} />
                                <input className="input-field" placeholder="מיקום" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
                                <select className="input-field" value={form.target_age_group} onChange={(event) => setForm((prev) => ({ ...prev, target_age_group: event.target.value }))}>
                                    <option value="">קהל יעד</option>
                                    <option value="kids">ילדים</option>
                                    <option value="teens">נוער</option>
                                    <option value="adults">מבוגרים</option>
                                    <option value="seniors">גיל שלישי</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מקום / אולם" value={form.venue} onChange={(event) => setForm((prev) => ({ ...prev, venue: event.target.value }))} />
                                <input className="input-field" placeholder="שם קבוצה" value={form.group_name} onChange={(event) => setForm((prev) => ({ ...prev, group_name: event.target.value }))} />
                            </div>
                            <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                                <legend style={{ fontWeight: 700, paddingInline: '0.5rem' }}>מפגשים</legend>
                                {form.schedules.map((schedule, index) => (
                                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <select className="input-field" value={schedule.day_of_week} onChange={(event) => setForm((prev) => ({ ...prev, schedules: prev.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, day_of_week: Number(event.target.value) } : item) }))}>
                                            {DAY_LABELS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                                        </select>
                                        <input type="time" className="input-field" value={schedule.start_time} onChange={(event) => setForm((prev) => ({ ...prev, schedules: prev.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: event.target.value } : item) }))} />
                                        <input type="time" className="input-field" value={schedule.end_time} onChange={(event) => setForm((prev) => ({ ...prev, schedules: prev.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: event.target.value } : item) }))} />
                                        <button type="button" className="btn btn-ghost btn-icon" aria-label={`הסר מפגש ${index + 1}`} onClick={() => setForm((prev) => ({ ...prev, schedules: prev.schedules.filter((_, itemIndex) => itemIndex !== index) }))}><X size={16} /></button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-secondary btn-md" onClick={() => setForm((prev) => ({ ...prev, schedules: [...prev.schedules, { day_of_week: 0, start_time: '', end_time: '' }] }))}>הוסף מפגש</button>
                            </fieldset>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                                <input type="date" className="input-field" value={form.start_date} onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))} />
                                <input type="date" className="input-field" value={form.end_date} onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))} />
                                <input className="input-field" placeholder="גיל מינימום" value={form.min_age} onChange={(event) => setForm((prev) => ({ ...prev, min_age: event.target.value }))} />
                                <input className="input-field" placeholder="גיל מקסימום" value={form.max_age} onChange={(event) => setForm((prev) => ({ ...prev, max_age: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מחיר" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
                                <input className="input-field" placeholder="מכסה" value={form.max_participants} onChange={(event) => setForm((prev) => ({ ...prev, max_participants: event.target.value }))} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.5rem', fontWeight: 700 }}>
                                    <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                                    חוג פעיל באתר
                                </label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="כיתה מינימלית (0–12)" value={form.min_grade} onChange={(event) => setForm((prev) => ({ ...prev, min_grade: event.target.value }))} />
                                <input className="input-field" placeholder="כיתה מקסימלית (0–12)" value={form.max_grade} onChange={(event) => setForm((prev) => ({ ...prev, max_grade: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="איש קשר" value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
                                <input className="input-field" placeholder="טלפון קשר" value={form.contact_phone} onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))} />
                                <input type="email" className="input-field" placeholder="דוא״ל קשר" value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
                            </div>
                            <textarea className="input-field" placeholder="הערות ומידע נוסף" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md">
                                {saving ? 'שומר חוג...' : editingClass ? 'שמור שינויים' : 'שמור חוג'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {pendingChange && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(13,27,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
                    <div className="card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-change-title" style={{ width: '100%', maxWidth: 760, padding: '2rem', background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 id="confirm-change-title">אישור שינוי במאגר</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBlock: '0.75rem' }}>הפעולה עדיין לא בוצעה. בדקו את החוג ואת הערכים החדשים לפני האישור.</p>
                        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', lineHeight: 1.7 }}>
                            <strong>פעולה:</strong> {pendingChange.operation === 'create' ? 'יצירה' : pendingChange.operation === 'update' ? 'עדכון' : 'העברה לארכיון'}<br />
                            <strong>חוג:</strong> {pendingChange.target?.title_he ?? String(pendingChange.changes.title_he ?? 'חוג חדש')}
                            {pendingChange.target && <><br /><strong>מצב קיים:</strong> {pendingChange.target.location || 'מיקום לא צוין'} · {pendingChange.target.days_of_week || 'יום לא צוין'} · {pendingChange.target.start_time?.slice(0, 5) || 'שעה לא צוינה'}</>}
                        </div>
                        {pendingChange.operation !== 'archive' && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBlock: '1rem' }}>{JSON.stringify(pendingChange.changes, null, 2)}</pre>}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-primary" disabled={saving} onClick={() => void confirmPendingChange()}>{saving ? 'מבצע...' : 'אני מאשר/ת את הפעולה המדויקת'}</button>
                            <button className="btn btn-secondary" disabled={saving} onClick={() => setPendingChange(null)}>ביטול</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
