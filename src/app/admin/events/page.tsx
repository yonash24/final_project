"use client";

import { Calendar, MapPin, Plus, Trash2, X, Clock, Pencil, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { AdminEvent } from '@/lib/admin/types';

interface EventFormState {
    title: string;
    description: string;
    event_date: string;
    start_time: string;
    end_time: string;
    location: string;
    type: string;
    category: string;
    max_attendees: string;
    current_attendees: string;
    is_published: boolean;
}

const EMPTY_FORM: EventFormState = {
    title: '',
    description: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location: '',
    type: 'פיזי',
    category: '',
    max_attendees: '',
    current_attendees: '',
    is_published: true,
};

function mapEventToForm(item: AdminEvent): EventFormState {
    return {
        title: item.title,
        description: item.description ?? '',
        event_date: item.event_date,
        start_time: item.start_time ? item.start_time.slice(0, 5) : '',
        end_time: item.end_time ? item.end_time.slice(0, 5) : '',
        location: item.location ?? '',
        type: item.type ?? 'פיזי',
        category: item.category ?? '',
        max_attendees: item.max_attendees?.toString() ?? '',
        current_attendees: item.current_attendees?.toString() ?? '',
        is_published: item.is_published,
    };
}

export default function AdminEventsPage() {
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
    const [form, setForm] = useState<EventFormState>(EMPTY_FORM);

    async function loadEvents() {
        const response = await fetch('/api/admin/events');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch events');
        return data as AdminEvent[];
    }

    async function refreshData() {
        setLoading(true);
        try {
            setEvents(await loadEvents());
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let ignore = false;

        void (async () => {
            setLoading(true);
            try {
                const data = await loadEvents();
                if (!ignore) {
                    setEvents(data);
                }
            } catch (error) {
                console.error('Error fetching events:', error);
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
        setEditingEvent(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    }

    function openEditModal(item: AdminEvent) {
        setEditingEvent(item);
        setForm(mapEventToForm(item));
        setShowModal(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);

        try {
            const response = await fetch(
                editingEvent ? `/api/admin/events/${editingEvent.id}` : '/api/admin/events',
                {
                    method: editingEvent ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                },
            );

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save event');

            setShowModal(false);
            setForm(EMPTY_FORM);
            setEditingEvent(null);
            await refreshData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירה';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteEvent(id: string) {
        if (!confirm('האם למחוק אירוע זה?')) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
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
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>עדכון מהיר של פרטי האירוע, פרסום ותפוסה במקום אחד.</p>
                    </div>
                    <button onClick={openCreateModal} className="btn btn-primary btn-md">
                        <Plus size={18} /> צור אירוע חדש
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>טוען אירועים...</div>
                    ) : events.length === 0 ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            אין אירועים כרגע.
                        </div>
                    ) : events.map((item) => {
                        const remainingSeats = item.max_attendees == null
                            ? null
                            : Math.max((item.max_attendees ?? 0) - (item.current_attendees ?? 0), 0);

                        return (
                            <div key={item.id} className="card" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center', borderLeft: '4px solid var(--accent-secondary)' }}>
                                <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '110px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <Calendar size={20} style={{ margin: '0 auto' }} />
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{new Date(item.event_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                                    <span style={{ fontSize: '0.8rem' }}>{item.start_time?.slice(0, 5) ?? 'שעה טרם הוגדרה'}</span>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{item.title}</h3>
                                        <span className="hero-badge" style={{ fontSize: '0.72rem' }}>{item.type ?? 'פיזי'}</span>
                                        <span
                                            style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                backgroundColor: item.is_published ? '#dcfce7' : '#e2e8f0',
                                                color: item.is_published ? '#166534' : '#475569',
                                            }}
                                        >
                                            {item.is_published ? 'מפורסם' : 'טיוטה'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {item.location && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', background: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>
                                                <MapPin size={14} /> {item.location}
                                            </span>
                                        )}
                                        {item.end_time && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <Clock size={14} /> עד {item.end_time.slice(0, 5)}
                                            </span>
                                        )}
                                        {item.category && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                {item.category}
                                            </span>
                                        )}
                                        {remainingSeats != null && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: remainingSeats === 0 ? '#dc2626' : remainingSeats < 10 ? '#b45309' : '#15803d' }}>
                                                <Users size={14} />
                                                {remainingSeats === 0 ? 'מלא' : `${remainingSeats} מקומות פנויים`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(item)} style={{ backgroundColor: '#e0f2fe' }} title="ערוך אירוע">
                                        <Pencil size={16} color="#0284c7" />
                                    </button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => deleteEvent(item.id)} style={{ color: 'var(--accent-rose)', backgroundColor: '#fee2e2' }} title="מחק אירוע">
                                        <Trash2 size={16} color="#dc2626" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '640px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <div>
                                <h2>{editingEvent ? 'עריכת אירוע' : 'הוספת אירוע'}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>פרטי האירוע ישפיעו גם על תזכורות עתידיות.</p>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="סגור">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required className="input-field" placeholder="שם האירוע" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '80px' }} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <input type="date" required className="input-field" value={form.event_date} onChange={(event) => setForm((prev) => ({ ...prev, event_date: event.target.value }))} />
                                <input type="time" className="input-field" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                                <input type="time" className="input-field" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מיקום / לינק" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
                                <select className="input-field" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                                    <option value="פיזי">פיזי</option>
                                    <option value="זום">זום</option>
                                </select>
                                <input className="input-field" placeholder="קטגוריה" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                                <input className="input-field" placeholder="מכסת משתתפים" value={form.max_attendees} onChange={(event) => setForm((prev) => ({ ...prev, max_attendees: event.target.value }))} />
                                <input className="input-field" placeholder="נרשמו כרגע" value={form.current_attendees} onChange={(event) => setForm((prev) => ({ ...prev, current_attendees: event.target.value }))} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700 }}>
                                    <input type="checkbox" checked={form.is_published} onChange={(event) => setForm((prev) => ({ ...prev, is_published: event.target.checked }))} />
                                    מפורסם באתר
                                </label>
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md">
                                {saving ? 'שומר...' : editingEvent ? 'שמור שינויים' : 'שמור אירוע'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
