"use client";
import Navbar from '@/components/layout/Navbar';
import { Clock, User, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ClassesPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    async function fetchClasses() {
        setLoading(true);
        const { data } = await supabase
            .from('activities')
            .select('*')
            .eq('is_active', true);

        if (data) setClasses(data);
        setLoading(false);
    }

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '2.5rem' }}>חוגים ופעילויות 🎨</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>גלו את עולם הפנאי וההעשרה של הקהילה שלנו</p>
                    </header>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>טוען חוגים...</div>
                    ) : (
                        <div className="features-grid" style={{ padding: 0 }}>
                            {classes.map((item, idx) => (
                                <div key={item.id} className="card feature-card animate-fade-up" style={{ animationDelay: `${0.1 * idx}s`, textAlign: 'right', alignItems: 'flex-start' }}>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title_he}</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{item.description_he}</p>
                                    <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={14} /> {item.days_of_week} | {item.start_time}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={14} /> {item.instructor_name}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={14} /> {item.location}</span>
                                    </div>
                                    <button className="btn btn-primary btn-md" style={{ width: '100%', marginTop: 'auto' }}>
                                        לפרטים והרשמה
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
