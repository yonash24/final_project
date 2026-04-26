'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowRight, Clock, MapPin, Users, BadgeDollarSign,
    UserCheck, CalendarDays, Loader2, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Navbar from '@/components/layout/Navbar';
import RegistrationModal from '@/components/ui/RegistrationModal';

interface Activity {
    id: string;
    title_he: string;
    description_he: string | null;
    days_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    price: number | null;
    location: string | null;
    min_age: number | null;
    max_age: number | null;
    instructor_name: string | null;
    max_participants: number | null;
    current_participants: number | null;
    target_age_group: string | null;
    is_active: boolean;
    categories: { name_he: string; icon: string | null } | null;
}

const AGE_GROUP_LABELS: Record<string, string> = {
    kids: 'ילדים',
    teens: 'נוער',
    adults: 'מבוגרים',
    seniors: 'קשישים',
};

export default function ActivityDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [activity, setActivity] = useState<Activity | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!id) return;
        (async () => {
            const { data, error } = await supabase
                .from('activities')
                .select('*, categories(name_he, icon)')
                .eq('id', id)
                .eq('is_active', true)
                .maybeSingle();

            if (error || !data) {
                setNotFound(true);
            } else {
                setActivity(data as Activity);
            }
            setLoading(false);
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="container" style={{ minHeight: '100vh' }}>
                <Navbar />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <Loader2 size={36} className="activity-spinner" />
                </div>
            </div>
        );
    }

    if (notFound || !activity) {
        return (
            <div className="container" style={{ minHeight: '100vh' }}>
                <Navbar />
                <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
                    <AlertCircle size={48} style={{ color: 'var(--accent-secondary)', margin: '0 auto 1rem' }} />
                    <h2 style={{ marginBottom: '0.5rem' }}>החוג לא נמצא 😕</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        ייתכן שהחוג הוסר או שהקישור אינו תקין.
                    </p>
                    <Link href="/classes" className="btn btn-primary btn-md">
                        לרשימת כל החוגים
                    </Link>
                </div>
            </div>
        );
    }

    const spotsLeft = activity.max_participants != null
        ? activity.max_participants - (activity.current_participants ?? 0)
        : null;
    const isFull = spotsLeft !== null && spotsLeft <= 0;
    const isLowSpots = spotsLeft !== null && spotsLeft > 0 && spotsLeft < 5;
    const mapUrl = activity.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
        : '';

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '2rem 0 5rem' }}>
                    {/* Back breadcrumb */}
                    <Link
                        href="/classes"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', textDecoration: 'none' }}
                    >
                        <ArrowRight size={16} />
                        חזרה לחוגים
                    </Link>

                    <div className="activity-detail-layout">
                        {/* ── Main info panel ── */}
                        <div className="activity-detail-card animate-fade-up">
                            {/* Category badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <span className="activity-detail-badge">
                                    {activity.categories?.icon ?? '🎨'} {activity.categories?.name_he ?? 'פעילות'}
                                </span>
                                {activity.target_age_group && (
                                    <span className="activity-detail-badge age-badge">
                                        👥 {AGE_GROUP_LABELS[activity.target_age_group] ?? activity.target_age_group}
                                    </span>
                                )}
                            </div>

                            <h1 className="activity-detail-title">{activity.title_he}</h1>

                            {activity.description_he && (
                                <p className="activity-detail-desc">{activity.description_he}</p>
                            )}

                            {/* Info grid */}
                            <div className="activity-info-grid">
                                {activity.days_of_week && (
                                    <div className="activity-info-item">
                                        <div className="activity-info-icon"><Clock size={18} /></div>
                                        <div>
                                            <div className="activity-info-label">ימי פעילות</div>
                                            <div className="activity-info-value">
                                                {activity.days_of_week}
                                                {activity.start_time && ` | ${activity.start_time.slice(0, 5)}`}
                                                {activity.end_time && `–${activity.end_time.slice(0, 5)}`}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activity.location && (
                                    <div className="activity-info-item">
                                        <div className="activity-info-icon"><MapPin size={18} /></div>
                                        <div>
                                            <div className="activity-info-label">מיקום</div>
                                            <div className="activity-info-value">{activity.location}</div>
                                        </div>
                                    </div>
                                )}

                                {(activity.min_age != null || activity.max_age != null) && (
                                    <div className="activity-info-item">
                                        <div className="activity-info-icon"><Users size={18} /></div>
                                        <div>
                                            <div className="activity-info-label">גיל מתאים</div>
                                            <div className="activity-info-value">
                                                {activity.min_age ?? 0}–{activity.max_age ?? '+'} שנים
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activity.instructor_name && (
                                    <div className="activity-info-item">
                                        <div className="activity-info-icon"><UserCheck size={18} /></div>
                                        <div>
                                            <div className="activity-info-label">מדריך/ה</div>
                                            <div className="activity-info-value">{activity.instructor_name}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="activity-info-item">
                                    <div className="activity-info-icon" style={{ color: 'var(--accent-primary)' }}>
                                        <BadgeDollarSign size={18} />
                                    </div>
                                    <div>
                                        <div className="activity-info-label">מחיר</div>
                                        <div className="activity-info-value" style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>
                                            {activity.price === 0 || activity.price == null ? 'חינם 🎉' : `₪${activity.price} לחודש`}
                                        </div>
                                    </div>
                                </div>

                                {spotsLeft !== null && (
                                    <div className="activity-info-item">
                                        <div className="activity-info-icon"><CalendarDays size={18} /></div>
                                        <div>
                                            <div className="activity-info-label">מקומות פנויים</div>
                                            <div
                                                className="activity-info-value"
                                                style={{
                                                    color: isFull ? '#dc2626' : isLowSpots ? '#b45309' : '#16a34a',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {isFull
                                                    ? 'מלא — אין מקומות 😔'
                                                    : isLowSpots
                                                        ? `נותרו רק ${spotsLeft} מקומות! ⚡`
                                                        : `${spotsLeft} מקומות פנויים ✓`}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Sidebar actions ── */}
                        <aside className="activity-detail-sidebar animate-fade-up" style={{ animationDelay: '0.15s' }}>
                            <div className="activity-sidebar-card">
                                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-primary)' }}>
                                        {activity.price === 0 || activity.price == null ? 'חינם' : `₪${activity.price}`}
                                    </div>
                                    {activity.price != null && activity.price > 0 && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>לחודש</div>
                                    )}
                                </div>

                                {/* Spots indicator */}
                                {spotsLeft !== null && (
                                    <div
                                        style={{
                                            padding: '0.6rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: '1rem',
                                            textAlign: 'center',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            background: isFull ? '#fee2e2' : isLowSpots ? '#fef3c7' : '#dcfce7',
                                            color: isFull ? '#dc2626' : isLowSpots ? '#b45309' : '#16a34a',
                                        }}
                                    >
                                        {isFull ? '⛔ מלא — אין מקומות' : `✅ ${spotsLeft} מקומות פנויים`}
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg"
                                    style={{ width: '100%', marginBottom: '0.75rem' }}
                                    disabled={isFull}
                                    onClick={() => setShowModal(true)}
                                    id={`register-activity-${activity.id}`}
                                >
                                    {isFull ? 'רשימת המתנה' : '✍️ הרשמה לחוג'}
                                </button>

                                {mapUrl && (
                                    <a
                                        href={mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary btn-md"
                                        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                                    >
                                        <MapPin size={16} />
                                        ניווט למיקום
                                    </a>
                                )}

                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>
                                    ניתן לבטל הרשמה עד 48 שעות לפני תחילת החוג
                                </p>
                            </div>

                            <Link href="/chat" className="btn btn-secondary btn-md" style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                                🤖 שאל את מתני
                            </Link>
                        </aside>
                    </div>
                </main>
            </div>

            {/* Registration Modal */}
            {showModal && (
                <RegistrationModal
                    activity={activity}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}
