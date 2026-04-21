"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Calendar, MapPin, Plus, Trash2, Edit2, X, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        event_date: '',
        start_time: '',
        location: '',
        type: 'פיזי'
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        setLoading(true);
        const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true });
        if (data) setEvents(data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('events').insert([newEvent]);
        if (!error) {
            setShowModal(false);
            setNewEvent({ title: '', description: '', event_date: '', start_time: '', location: '', type: 'פיזי' });
            fetchEvents();
        }
    }

    async function deleteEvent(id: string) {
        if (confirm('האם למחוק אירוע זה?')) {
            await supabase.from('events').delete().eq('id', id);
            fetchEvents();
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>ניהול ומעקב אירועים קהילתיים</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <Plus size={18} /> צור אירוע חדש
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {events.map(e => (
                        <div key={e.id} className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '100px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{new Date(e.event_date).toLocaleDateString('he-IL')}</span>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{e.title}</h3>
                                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        <span><MapPin size={14} /> {e.location}</span>
                                        <span><Clock size={14} /> {e.start_time}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-ghost btn-icon" onClick={() => deleteEvent(e.id)} style={{ color: 'var(--accent-rose)' }}><Trash2 size={16} /></button>
                            </div>
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
                            <input required className="input-field" placeholder="שם האירוע" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '80px' }} value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="date" required className="input-field" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                                <input type="time" className="input-field" value={newEvent.start_time} onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מיקום / לינק" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} />
                                <select className="input-field" value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
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
