"use client";

import { Calendar, MapPin, Plus, Trash2, X, Clock } from 'lucide-react';
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
};

export default function AdminEventsPage() {
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<EventFormState>(EMPTY_FORM);

    async function loadEvents() {
        const response = await fetch('/api/admin/events');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch events');
        return data as AdminEvent[];
    }

    useEffect(() => {
        let ignore = false;
        void loadEvents()
            .then((data) => {
                if (!ignore) setEvents(data);
            })
            .catch((error) => {
                console.error('Error fetching events:', error);
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
        setLoading(true);

        try {
            const response = await fetch('/api/admin/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    is_published: true,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save event');

            setShowModal(false);
            setForm(EMPTY_FORM);
            setEvents(await loadEvents());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירה';
            alert(message);
        } finally {
            setLoading(false);
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
            setEvents(await loadEvents());
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
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>ניהול ומעקב אירועים קהילתיים דרך API מאובטח</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <Plus size={18} /> צור אירוע חדש
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>טוען אירועים...</div>
                    ) : events.map((item) => (
                        <div key={item.id} className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--accent-secondary)' }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '110px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <Calendar size={20} style={{ margin: '0 auto' }} />
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{new Date(item.event_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>{item.title}</h3>
                                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {item.location && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', background: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>
                                                <MapPin size={14} /> {item.location}
                                            </span>
                                        )}
                                        {item.start_time && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={14} /> {item.start_time}</span>
                                        )}
                                        {item.type && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#e0f2fe', color: 'var(--accent-primary)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>{item.type}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => deleteEvent(item.id)} style={{ color: 'var(--accent-rose)', backgroundColor: '#fee2e2' }} title="מחק אירוע">
                                <Trash2 size={16} color="#dc2626" />
                            </button>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>הוספת אירוע</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required className="input-field" placeholder="שם האירוע" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '80px' }} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="date" required className="input-field" value={form.event_date} onChange={(event) => setForm((prev) => ({ ...prev, event_date: event.target.value }))} />
                                <input type="time" className="input-field" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="time" className="input-field" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                                <input className="input-field" placeholder="קטגוריה" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מיקום / לינק" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
                                <select className="input-field" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                                    <option value="פיזי">פיזי</option>
                                    <option value="זום">זום</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary btn-md">שמור אירוע</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
