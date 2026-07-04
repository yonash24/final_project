"use client";

import Link from 'next/link';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { AdminActivity } from '@/lib/admin/types';

interface ActivityFormState {
    title_he: string;
    description_he: string;
    instructor_name: string;
    days_of_week: string;
    start_time: string;
    end_time: string;
    location: string;
    min_age: string;
    max_age: string;
    price: string;
    max_participants: string;
}

const EMPTY_FORM: ActivityFormState = {
    title_he: '',
    description_he: '',
    instructor_name: '',
    days_of_week: '',
    start_time: '',
    end_time: '',
    location: '',
    min_age: '',
    max_age: '',
    price: '',
    max_participants: '',
};

export default function AdminClassesPage() {
    const [classes, setClasses] = useState<AdminActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<ActivityFormState>(EMPTY_FORM);

    async function loadClasses() {
        const response = await fetch('/api/admin/activities');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch activities');
        return data as AdminActivity[];
    }

    useEffect(() => {
        let ignore = false;
        void loadClasses()
            .then((data) => {
                if (!ignore) setClasses(data);
            })
            .catch((error) => {
                console.error('Fetch error:', error);
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setLoading(true);

        try {
            const response = await fetch('/api/admin/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    min_age: form.min_age,
                    max_age: form.max_age,
                    price: form.price,
                    max_participants: form.max_participants,
                    is_active: true,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.formErrors?.join(', ') || data.error || 'Failed to save');
            }

            setShowModal(false);
            setForm(EMPTY_FORM);
            setClasses(await loadClasses());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירת החוג';
            alert(message);
        } finally {
            setSaving(false);
            setLoading(false);
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
            setClasses(await loadClasses());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה במחיקה';
            alert(message);
        } finally {
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
                        <p style={{ color: 'var(--text-secondary)' }}>ניהול חוגים דרך API מאובטח וייבוא מרוכז</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <Link href="/admin/classes/import" className="btn btn-secondary btn-md">
                            <Upload size={18} /> ייבוא אקסל
                        </Link>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                            <Plus size={18} /> הוסף חוג חדש
                        </button>
                    </div>
                </header>

                <div className="card">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '1rem' }}>שם החוג</th>
                                    <th style={{ padding: '1rem' }}>מדריך</th>
                                    <th style={{ padding: '1rem' }}>זמנים</th>
                                    <th style={{ padding: '1rem' }}>גילים/מחיר</th>
                                    <th style={{ padding: '1rem' }}>מיקום</th>
                                    <th style={{ padding: '1rem' }}>פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            אין חוגים רשומים במערכת.
                                        </td>
                                    </tr>
                                ) : classes.map((activity) => (
                                    <tr key={activity.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                            {activity.title_he}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                            {activity.instructor_name || '-'}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                            {activity.days_of_week || '-'}
                                            {activity.start_time ? ` | ${activity.start_time.slice(0, 5)}` : ''}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                            גיל {activity.min_age ?? '-'}-{activity.max_age ?? '-'} | {activity.price ?? 0}₪
                                        </td>
                                        <td style={{ padding: '1rem' }}>{activity.location || '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => deleteClass(activity.id)}
                                                style={{ backgroundColor: '#fee2e2', width: '32px', height: '32px' }}
                                                title="מחק חוג"
                                            >
                                                <Trash2 size={16} color="#dc2626" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '720px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>הוספת חוג חדש</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required className="input-field" placeholder="שם החוג" value={form.title_he} onChange={(event) => setForm((prev) => ({ ...prev, title_he: event.target.value }))} />
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '90px' }} value={form.description_he} onChange={(event) => setForm((prev) => ({ ...prev, description_he: event.target.value }))} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="שם המדריך" value={form.instructor_name} onChange={(event) => setForm((prev) => ({ ...prev, instructor_name: event.target.value }))} />
                                <input className="input-field" placeholder="מיקום" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="ימים (למשל ראשון,שלישי)" value={form.days_of_week} onChange={(event) => setForm((prev) => ({ ...prev, days_of_week: event.target.value }))} />
                                <input type="time" className="input-field" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                                <input type="time" className="input-field" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                <input className="input-field" placeholder="גיל מינימום" value={form.min_age} onChange={(event) => setForm((prev) => ({ ...prev, min_age: event.target.value }))} />
                                <input className="input-field" placeholder="גיל מקסימום" value={form.max_age} onChange={(event) => setForm((prev) => ({ ...prev, max_age: event.target.value }))} />
                                <input className="input-field" placeholder="מחיר" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
                                <input className="input-field" placeholder="מכסה" value={form.max_participants} onChange={(event) => setForm((prev) => ({ ...prev, max_participants: event.target.value }))} />
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md">
                                {saving ? 'שומר חוג...' : 'שמור חוג'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
