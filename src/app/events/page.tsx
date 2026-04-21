"use client";
import Navbar from '@/components/layout/Navbar';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        setLoading(true);
        const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: true });
        if (data) setEvents(data);
        if (error) console.error('Error fetching events:', error);
        setLoading(false);
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
                    <header style={{ marginBottom: '3rem' }}>
                        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>האירועים הכי חמים בקהילה שלנו</p>
                    </header>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>טוען אירועים...</div>
                    ) : (
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
                                            <a href={getGoogleCalendarUrl(evt)} target="_blank" className="btn btn-secondary btn-sm">📅 יומן Google</a>
                                            {evt.location && evt.type !== 'זום' && (
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`} target="_blank" className="btn btn-outline btn-sm">📍 ניווט במפות</a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
