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
    days_of_week: string;
    start_time: string;
    end_time: string;
    start_date: string;
    end_date: string;
    location: string;
    min_age: string;
    max_age: string;
    price: string;
    max_participants: string;
    is_active: boolean;
}

const EMPTY_FORM: ActivityFormState = {
    title_he: '',
    description_he: '',
    category_id: '',
    target_age_group: '',
    instructor_name: '',
    days_of_week: '',
    start_time: '',
    end_time: '',
    start_date: '',
    end_date: '',
    location: '',
    min_age: '',
    max_age: '',
    price: '',
    max_participants: '',
    is_active: true,
};

function mapActivityToForm(activity: AdminActivity): ActivityFormState {
    return {
        title_he: activity.title_he ?? '',
        description_he: activity.description_he ?? '',
        category_id: activity.category_id ?? '',
        target_age_group: activity.target_age_group ?? '',
        instructor_name: activity.instructor_name ?? '',
        days_of_week: activity.days_of_week ?? '',
        start_time: activity.start_time ? activity.start_time.slice(0, 5) : '',
        end_time: activity.end_time ? activity.end_time.slice(0, 5) : '',
        start_date: activity.start_date ?? '',
        end_date: activity.end_date ?? '',
        location: activity.location ?? '',
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
        return (data ?? []) as CategoryOption[];
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
                    body: JSON.stringify(form),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.formErrors?.join(', ') || data.error || 'Failed to save');
            }

            setShowModal(false);
            setForm(EMPTY_FORM);
            setEditingClass(null);
            await refreshData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירת החוג';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteClass(id: string) {
        if (!confirm('האם למחוק חוג זה מהמערכת?')) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/admin/activities/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Delete failed');
            }
            await refreshData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה במחיקה';
            alert(message);
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול חוגים 📚</h1>
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

                <div className="card" style={{ padding: '1rem' }}>
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
                                                        backgroundColor: activity.is_active ? '#dcfce7' : '#e2e8f0',
                                                        color: activity.is_active ? '#166534' : '#475569',
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
                                                        color: spotsLeft === 0 ? '#dc2626' : spotsLeft < 5 ? '#b45309' : '#15803d',
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
                                                style={{ backgroundColor: '#e0f2fe' }}
                                            >
                                                <Pencil size={16} color="#0284c7" />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => deleteClass(activity.id)}
                                                style={{ backgroundColor: '#fee2e2' }}
                                                title="מחק חוג"
                                            >
                                                <Trash2 size={16} color="#dc2626" />
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
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="ימים (למשל ראשון, שלישי)" value={form.days_of_week} onChange={(event) => setForm((prev) => ({ ...prev, days_of_week: event.target.value }))} />
                                <input type="time" className="input-field" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                                <input type="time" className="input-field" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                            </div>
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
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md">
                                {saving ? 'שומר חוג...' : editingClass ? 'שמור שינויים' : 'שמור חוג'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
