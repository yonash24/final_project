"use client";
import Navbar from '@/components/layout/Navbar';
import { Search, Filter, Plus, Calendar, User, Clock, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ClassesPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [newClass, setNewClass] = useState({
        title_he: '',
        description_he: '',
        category_id: '',
        target_age_group: '',
        days_of_week: '',
        start_time: '',
        instructor_name: '',
        location: ''
    });

    useEffect(() => {
        fetchClasses();
    }, []);

    async function fetchClasses() {
        setLoading(true);
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('is_active', true);

        if (data) setClasses(data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase
            .from('activities')
            .insert([{
                ...newClass,
                title: newClass.title_he, // placeholder for English field
                is_active: true
            }]);

        if (!error) {
            setShowModal(false);
            fetchClasses();
        } else {
            alert('שגיאה בשמירת החוג: ' + error.message);
        }
    }

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h1 style={{ fontSize: '2.5rem' }}>חוגים ופעילויות 🎨</h1>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                                <Plus size={18} /> הוסף חוג חדש
                            </button>
                        </div>
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

            {/* Modal - Add New Class */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '600px', padding: '2rem', backgroundColor: 'white' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>הוספת חוג חדש</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>שם החוג</label>
                                    <input required className="input-field" value={newClass.title_he} onChange={e => setNewClass({ ...newClass, title_he: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>שם מדריך/ה</label>
                                    <input className="input-field" value={newClass.instructor_name} onChange={e => setNewClass({ ...newClass, instructor_name: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>תיאור</label>
                                <textarea className="input-field" style={{ height: '80px', paddingTop: '0.5rem' }} value={newClass.description_he} onChange={e => setNewClass({ ...newClass, description_he: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>ימים (למשל: א', ד')</label>
                                    <input className="input-field" value={newClass.days_of_week} onChange={e => setNewClass({ ...newClass, days_of_week: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>שעת התחלה</label>
                                    <input type="time" className="input-field" value={newClass.start_time} onChange={e => setNewClass({ ...newClass, start_time: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold' }}>מיקום / חדר</label>
                                <input className="input-field" value={newClass.location} onChange={e => setNewClass({ ...newClass, location: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>שמור חוג</button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>ביטול</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
