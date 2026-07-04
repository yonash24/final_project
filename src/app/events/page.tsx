"use client";

import Navbar from '@/components/layout/Navbar';
import { MapPin, Clock, Search, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface PublicEvent {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    type: string | null;
    category: string | null;
    max_attendees: number | null;
    current_attendees: number | null;
}

export default function EventsPage() {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | '7' | '30'>('all');

    useEffect(() => {
        void (async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('is_published', true)
                .order('event_date', { ascending: true });
            if (data) setEvents(data as PublicEvent[]);
            if (error) console.error('Error fetching events:', error);
            setLoading(false);
        })();
    }, []);

    function getGoogleCalendarUrl(event: PublicEvent) {
        const start = event.event_date.replace(/-/g, '') + 'T' + (event.start_time?.replace(/:/g, '') || '000000');
        const end = event.event_date.replace(/-/g, '') + 'T' + (event.end_time?.replace(/:/g, '') || event.start_time?.replace(/:/g, '') || '000000');
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}&sf=true&output=xml`;
    }

    const filteredEvents = events.filter((evt) => {
        const matchesSearch = [evt.title, evt.description, evt.location, evt.category]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = selectedType === 'all' || evt.type === selectedType;

        if (selectedTimeframe === 'all') {
            return matchesSearch && matchesType;
        }

        const eventDate = new Date(`${evt.event_date}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        endDate.setDate(today.getDate() + Number(selectedTimeframe));

        return matchesSearch && matchesType && eventDate >= today && eventDate <= endDate;
    });

    return (
        <>
            <div className="container">
                <Navbar />
                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>גלו אירועים קרובים לפי סוג, מועד וזמינות.</p>

                        <div className="discovery-toolbar">
                            <label className="discovery-search">
                                <Search size={18} />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="חפשו אירוע, קטגוריה או מיקום"
                                />
                            </label>
                            <div className="discovery-filters">
                                <select className="input-field" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                                    <option value="all">כל הסוגים</option>
                                    <option value="פיזי">פיזי</option>
                                    <option value="זום">זום</option>
                                </select>
                                <select className="input-field" value={selectedTimeframe} onChange={(event) => setSelectedTimeframe(event.target.value as 'all' | '7' | '30')}>
                                    <option value="all">כל התאריכים</option>
                                    <option value="7">7 הימים הקרובים</option>
                                    <option value="30">30 הימים הקרובים</option>
                                </select>
                            </div>
                        </div>

                        {!loading && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                מציגים {filteredEvents.length} מתוך {events.length} אירועים
                            </div>
                        )}
                    </header>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>טוען אירועים...</div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            לא נמצאו אירועים לפי הסינון שבחרת.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
                            {filteredEvents.map((evt) => {
                                const seatsLeft = evt.max_attendees == null
                                    ? null
                                    : Math.max((evt.max_attendees ?? 0) - (evt.current_attendees ?? 0), 0);

                                return (
                                    <div key={evt.id} className="card animate-fade-up" style={{ padding: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                        <div style={{ minWidth: '110px', textAlign: 'center', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{new Date(evt.event_date).getDate()}</div>
                                            <div style={{ color: 'var(--text-secondary)' }}>{new Date(evt.event_date).toLocaleString('he-IL', { month: 'short' })}</div>
                                            {evt.start_time && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>{evt.start_time.slice(0, 5)}</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{evt.title}</h3>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                                        {evt.type && <span className="hero-badge" style={{ backgroundColor: evt.type === 'זום' ? '#e0e7ff' : '#e0f2fe', color: evt.type === 'זום' ? '#4338ca' : 'var(--accent-primary)' }}>{evt.type}</span>}
                                                        {evt.category && <span className="hero-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>{evt.category}</span>}
                                                        {seatsLeft != null && (
                                                            <span className="hero-badge" style={{ backgroundColor: seatsLeft === 0 ? '#fee2e2' : seatsLeft < 10 ? '#fef3c7' : '#dcfce7', color: seatsLeft === 0 ? '#dc2626' : seatsLeft < 10 ? '#b45309' : '#15803d' }}>
                                                                {seatsLeft === 0 ? 'אין מקומות' : `${seatsLeft} מקומות פנויים`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{evt.description}</p>
                                            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                                {evt.start_time && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} /> {evt.start_time.slice(0, 5)}{evt.end_time ? `–${evt.end_time.slice(0, 5)}` : ''}</span>
                                                )}
                                                {evt.location && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={16} /> {evt.location}</span>
                                                )}
                                                {evt.max_attendees != null && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={16} /> {evt.current_attendees ?? 0}/{evt.max_attendees} רשומים</span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                <a href={getGoogleCalendarUrl(evt)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">יומן Google</a>
                                                {evt.location && evt.type !== 'זום' && (
                                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">ניווט במפות</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
