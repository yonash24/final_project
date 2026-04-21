"use client";
import Navbar from '@/components/layout/Navbar';
import { Calendar, MapPin, Share2, Plus, Clock, Globe, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        event_date: '',
        start_time: '',
        location: '',
        type: 'פיזי' // 'פיזי' or 'זום'
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
            fetchEvents();
        } else {
            alert('שגיאה: ' + error.message);
        }
    }

    function getGoogleCalendarUrl(event: any) {
        const start = event.event_date.replace(/-/g, '') + 'T' + (event.start_time?.replace(/:/g, '') || '000000');
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${start}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}&sf=true&output=xml`;
    }

    return (
        <>
            <div className="container">
                <Navbar />
                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>אירועים 📅</h1>
                            <p style={{ color: 'var(--text-secondary)' }}>האירועים הכי חמים בקהילה שלנו</p>
                        </div>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                            <Plus size={18} /> הוסף אירוע חדש
                        </button>
                    </header>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                        {events.map((evt, idx) => (
                            <div key={evt.id} className="card animate-fade-up" style={{ padding: '2rem', display: 'flex', gap: '2rem' }}>
                                <div style={{ minWidth: '100px', textAlign: 'center', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{new Date(evt.event_date).getDate()}</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>{new Date(evt.event_date).toLocaleString('he-IL', { month: 'short' })}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{evt.title}</h3>
                                        {evt.type === 'זום' && <span className="hero-badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>ZOOM</span>}
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{evt.description}</p>
                                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} /> {evt.start_time}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={16} /> {evt.location}</span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <a href={getGoogleCalendarUrl(evt)} target="_blank" className="btn btn-secondary btn-sm" style={{ fontWeight: '600' }}>
                                            📅 יומן Google
                                        </a>
                                        {evt.location && evt.type !== 'זום' && (
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`} target="_blank" className="btn btn-outline btn-sm">
                                                📍 ניווט במפות
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>צור אירוע חדש</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <input required className="input-field" placeholder="שם האירוע" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                            <textarea className="input-field" placeholder="תיאור האירוע" style={{ height: '80px', paddingTop: '0.5rem' }} value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="date" required className="input-field" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                                <input type="time" className="input-field" value={newEvent.start_time} onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="מיקום (או לינק זום)" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} />
                                <select className="input-field" value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
                                    <option value="פיזי">📍 פיזי</option>
                                    <option value="זום">💻 זום</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary btn-md">פרסם אירוע</button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
