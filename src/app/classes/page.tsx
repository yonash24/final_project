"use client";

import Navbar from '@/components/layout/Navbar';
import { Clock, User, MapPin, BadgeDollarSign, Users, Search, SlidersHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RegistrationModal from '@/components/ui/RegistrationModal';

const needPresets = [
    {
        label: 'משהו רגוע לגיל שלישי',
        apply: () => ({ searchTerm: '', selectedCategory: 'all', selectedAgeGroup: 'seniors', availabilityFilter: 'all' as const }),
    },
    {
        label: 'פעילות לילדים עם מקום פנוי',
        apply: () => ({ searchTerm: '', selectedCategory: 'all', selectedAgeGroup: 'kids', availabilityFilter: 'open' as const }),
    },
    {
        label: 'חוגים בחינם',
        apply: () => ({ searchTerm: 'חינם', selectedCategory: 'all', selectedAgeGroup: 'all', availabilityFilter: 'all' as const }),
    },
    {
        label: 'משהו חברתי למבוגרים',
        apply: () => ({ searchTerm: 'קבוצה', selectedCategory: 'all', selectedAgeGroup: 'adults', availabilityFilter: 'all' as const }),
    },
];

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
    target_age_group: string | null;
    categories: { name_he: string } | null;
}

export default function ClassesPage() {
    const [classes, setClasses] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [registerActivity, setRegisterActivity] = useState<Activity | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedAgeGroup, setSelectedAgeGroup] = useState('all');
    const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'open' | 'few' | 'full'>('all');
    const router = useRouter();

    useEffect(() => {
        void (async () => {
            setLoading(true);
            const response = await fetch('/api/activities');
            if (response.ok) setClasses(await response.json() as Activity[]);
            setLoading(false);
        })();
    }, []);

    const categoryOptions = Array.from(new Set(classes.map((item) => item.categories?.name_he).filter(Boolean))) as string[];

    const filteredClasses = classes.filter((item) => {
        const spotsLeft = item.max_participants != null
            ? item.max_participants - (item.current_participants ?? 0)
            : null;
        const matchesSearch = [
            item.title_he,
            item.description_he,
            item.instructor_name,
            item.location,
            item.categories?.name_he,
            item.target_age_group === 'seniors' ? 'גיל שלישי קשישים מבוגרים רגוע' : null,
            item.target_age_group === 'kids' ? 'ילדים הורים משפחה' : null,
            item.price === 0 ? 'חינם ללא עלות' : null,
        ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'all' || item.categories?.name_he === selectedCategory;
        const matchesAgeGroup = selectedAgeGroup === 'all' || item.target_age_group === selectedAgeGroup;
        const matchesAvailability = availabilityFilter === 'all'
            || (availabilityFilter === 'open' && (spotsLeft == null || spotsLeft >= 5))
            || (availabilityFilter === 'few' && spotsLeft != null && spotsLeft > 0 && spotsLeft < 5)
            || (availabilityFilter === 'full' && spotsLeft != null && spotsLeft <= 0);

        return matchesSearch && matchesCategory && matchesAgeGroup && matchesAvailability;
    });

    return (
        <>
            <div className="container">
                <Navbar />

                <main id="main-content" style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: '0.5rem' }}>חוגים ופעילויות 🎨</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>אפשר לחפש לפי נושא, גיל, זמינות או פשוט לפי צורך יומיומי.</p>

                        <div className="friendly-helper-card">
                            <strong>מחפשים משהו בלי להסתבך?</strong>
                            <p>אפשר להתחיל מאחד המסלולים המהירים כאן, או לכתוב מילה פשוטה כמו &quot;רגוע&quot;, &quot;לילדים&quot; או &quot;חינם&quot;.</p>
                            <div className="pill-row">
                                {needPresets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        className="pill-choice"
                                        onClick={() => {
                                            const values = preset.apply();
                                            setSearchTerm(values.searchTerm);
                                            setSelectedCategory(values.selectedCategory);
                                            setSelectedAgeGroup(values.selectedAgeGroup);
                                            setAvailabilityFilter(values.availabilityFilter);
                                        }}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="discovery-toolbar">
                            <label className="discovery-search">
                                <Search size={18} />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="חפשו חוג, צורך, מדריך או מיקום"
                                />
                            </label>
                            <div className="discovery-filters">
                                <span className="discovery-filter-label"><SlidersHorizontal size={16} /> סינון</span>
                                <select className="input-field" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                                    <option value="all">כל הקטגוריות</option>
                                    {categoryOptions.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                                <select className="input-field" value={selectedAgeGroup} onChange={(event) => setSelectedAgeGroup(event.target.value)}>
                                    <option value="all">כל הגילאים</option>
                                    <option value="kids">ילדים</option>
                                    <option value="teens">נוער</option>
                                    <option value="adults">מבוגרים</option>
                                    <option value="seniors">גיל שלישי</option>
                                </select>
                                <select className="input-field" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as 'all' | 'open' | 'few' | 'full')}>
                                    <option value="all">כל הזמינויות</option>
                                    <option value="open">יש מקום</option>
                                    <option value="few">מקומות אחרונים</option>
                                    <option value="full">מלא</option>
                                </select>
                            </div>
                        </div>

                        {!loading && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                מציגים {filteredClasses.length} מתוך {classes.length} חוגים פעילים
                            </div>
                        )}
                    </header>

                    {loading ? (
                        <div className="skeleton-grid">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="skeleton-card">
                                    <div className="skeleton-line short" />
                                    <div className="skeleton-line medium" />
                                    <div className="skeleton-line long" />
                                    <div className="skeleton-block" />
                                </div>
                            ))}
                        </div>
                    ) : filteredClasses.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            לא מצאנו כרגע משהו שמתאים בדיוק למה שבחרת. נסו לחפש מילה פשוטה אחרת, להרחיב את הסינון או לעבור ל&quot;דברו איתי פשוט&quot;.
                        </div>
                    ) : (
                        <div className="features-grid" style={{ padding: 0 }}>
                            {filteredClasses.map((item, idx) => {
                                const spotsLeft = item.max_participants != null
                                    ? item.max_participants - (item.current_participants ?? 0)
                                    : null;
                                const isFull = spotsLeft !== null && spotsLeft <= 0;
                                const isLow = spotsLeft !== null && spotsLeft > 0 && spotsLeft < 5;
                                const fillPercent = item.max_participants
                                    ? Math.min(((item.current_participants ?? 0) / item.max_participants) * 100, 100)
                                    : 0;

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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', width: '100%', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--primary-50)', color: 'var(--accent-primary)', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
                                                {item.categories?.name_he ?? 'חוג'}
                                            </span>
                                            {spotsLeft !== null && (
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '999px',
                                                    background: isFull ? 'var(--status-full-bg)' : isLow ? 'var(--status-low-bg)' : 'var(--status-open-bg)',
                                                    color: isFull ? 'var(--status-full-text)' : isLow ? 'var(--status-low-text)' : 'var(--status-open-text)',
                                                }}>
                                                    {isFull ? 'מלא' : isLow ? 'מקומות אחרונים' : `${spotsLeft} מקומות`}
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title_he}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {item.description_he}
                                        </p>

                                        {item.max_participants != null && (
                                            <div style={{ width: '100%', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>תפוסה</span>
                                                    <span style={{ fontWeight: 700 }}>{item.current_participants ?? 0}/{item.max_participants}</span>
                                                </div>
                                                <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--neutral-200)', overflow: 'hidden' }}>
                                                    <div
                                                        style={{
                                                            width: `${fillPercent}%`,
                                                            height: '100%',
                                                            backgroundColor: isFull ? 'var(--error-600)' : isLow ? 'var(--warning-500)' : 'var(--success-500)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

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
                                                    <Users size={14} /> גיל {item.min_age == null && item.max_age == null ? 'לא צוין' : `${item.min_age ?? 'לא צוין'}–${item.max_age ?? 'לא צוין'}`}
                                                </span>
                                            )}
                                            {item.price != null && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                                    <BadgeDollarSign size={14} /> {item.price == null ? 'מחיר לא צוין' : item.price === 0 ? 'חינם' : `₪${item.price} לחודש`}
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
                                                {isFull ? 'מלא כרגע' : 'הרשמה'}
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
                    onRegistered={({ currentParticipants }) => {
                        setClasses((previous) => previous.map((item) => item.id === registerActivity.id
                            ? { ...item, current_participants: currentParticipants ?? item.current_participants }
                            : item));
                    }}
                />
            )}
        </>
    );
}
