"use client";
import Navbar from '@/components/layout/Navbar';
import { Clock, User, MapPin, BadgeDollarSign, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import RegistrationModal from '@/components/ui/RegistrationModal';

interface Activity {
    id: string;
    title_he: string;
    description_he: string | null;
    days_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    instructor_name: string | null;
    location: string | null;
    price: number | null;
    min_age: number | null;
    max_age: number | null;
    max_participants: number | null;
    current_participants: number | null;
    categories: { name_he: string } | null;
}

export default function ClassesPage() {
    const [classes, setClasses] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [registerActivity, setRegisterActivity] = useState<Activity | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchClasses();
    }, []);

    async function fetchClasses() {
        setLoading(true);
        const { data } = await supabase
            .from('activities')
            .select('*, categories(name_he)')
            .eq('is_active', true)
            .order('title_he', { ascending: true });

        if (data) setClasses(data as Activity[]);
        setLoading(false);
    }

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '2.5rem' }}>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>חוגים ופעילויות 🎨</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>גלו את עולם הפנאי וההעשרה של הקהילה שלנו</p>
                    </header>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>טוען חוגים...</div>
                    ) : classes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            אין חוגים פעילים כרגע.
                        </div>
                    ) : (
                        <div className="features-grid" style={{ padding: 0 }}>
                            {classes.map((item, idx) => {
                                const spotsLeft = item.max_participants != null
                                    ? item.max_participants - (item.current_participants ?? 0)
                                    : null;
                                const isFull = spotsLeft !== null && spotsLeft <= 0;
                                const isLow = spotsLeft !== null && spotsLeft > 0 && spotsLeft < 5;

                                return (
                                    <div
                                        key={item.id}
                                        className="card feature-card animate-fade-up"
                                        style={{
                                            animationDelay: `${0.07 * idx}s`,
                                            textAlign: 'right',
                                            alignItems: 'flex-start',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => router.push(`/classes/${item.id}`)}
                                    >
                                        {/* Category + spots row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', width: '100%' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#e0f2fe', color: 'var(--accent-primary)', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
                                                {item.categories?.name_he ?? 'חוג'}
                                            </span>
                                            {spotsLeft !== null && (
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '999px',
                                                    background: isFull ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
                                                    color: isFull ? '#dc2626' : isLow ? '#b45309' : '#16a34a',
                                                }}>
                                                    {isFull ? 'מלא' : `${spotsLeft} מקומות`}
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title_he}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {item.description_he}
                                        </p>

                                        <div style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', width: '100%' }}>
                                            {item.days_of_week && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Clock size={14} /> {item.days_of_week}{item.start_time ? ` | ${item.start_time.slice(0, 5)}` : ''}
                                                </span>
                                            )}
                                            {item.instructor_name && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <User size={14} /> {item.instructor_name}
                                                </span>
                                            )}
                                            {item.location && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <MapPin size={14} /> {item.location}
                                                </span>
                                            )}
                                            {(item.min_age != null || item.max_age != null) && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Users size={14} /> גיל {item.min_age ?? 0}–{item.max_age ?? '+'}
                                                </span>
                                            )}
                                            {item.price != null && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                                    <BadgeDollarSign size={14} /> {item.price === 0 ? 'חינם' : `₪${item.price} לחודש`}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                                            <button
                                                className="btn btn-secondary btn-md"
                                                style={{ flex: 1 }}
                                                onClick={(e) => { e.stopPropagation(); router.push(`/classes/${item.id}`); }}
                                            >
                                                פרטים
                                            </button>
                                            <button
                                                className="btn btn-primary btn-md"
                                                style={{ flex: 1 }}
                                                disabled={isFull}
                                                onClick={(e) => { e.stopPropagation(); setRegisterActivity(item); }}
                                                id={`register-${item.id}`}
                                            >
                                                {isFull ? 'מלא' : 'הרשמה'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {registerActivity && (
                <RegistrationModal
                    activity={registerActivity}
                    onClose={() => setRegisterActivity(null)}
                />
            )}
        </>
    );
}
