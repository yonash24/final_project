"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminClassesPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [newClass, setNewClass] = useState({
        title_he: '',
        description_he: '',
        instructor_name: '',
        days_of_week: '',
        start_time: '',
        location: ''
    });

    useEffect(() => {
        fetchClasses();
    }, []);

    async function fetchClasses() {
        setLoading(true);
        const { data, error } = await supabase.from('activities').select('*');
        if (data) setClasses(data);
        if (error) console.error('Fetch error:', error);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        // Verify database connection and save
        const { data, error } = await supabase
            .from('activities')
            .insert([{
                ...newClass,
                title: newClass.title_he,
                is_active: true
            }])
            .select();

        setSaving(false);

        if (!error) {
            alert('✅ החוג נשמר בהצלחה בבסיס הנתונים!');
            setShowModal(false);
            setNewClass({ title_he: '', description_he: '', instructor_name: '', days_of_week: '', start_time: '', location: '' });
            fetchClasses();
        } else {
            console.error('Database Error:', error);
            alert('❌ שגיאה בשמירה לדאטהבייס: ' + error.message);
        }
    }

    async function deleteClass(id: string) {
        if (confirm('האם למחוק חוג זה מהדאטהבייס?')) {
            const { error } = await supabase.from('activities').delete().eq('id', id);
            if (!error) fetchClasses();
            else alert('שגיאה במחיקה: ' + error.message);
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול חוגים 📚</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>ניהול נתונים השמורים ב-Supabase</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <Plus size={18} /> הוסף חוג חדש
                    </button>
                </header>

                <div className="card">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '1rem' }}>שם החוג</th>
                                    <th style={{ padding: '1rem' }}>מדריך</th>
                                    <th style={{ padding: '1rem' }}>זמנים</th>
                                    <th style={{ padding: '1rem' }}>מיקום</th>
                                    <th style={{ padding: '1rem' }}>פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין חוגים רשומים בדאטהבייס.</td></tr>
                                ) : classes.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{c.title_he}</td>
                                        <td style={{ padding: '1rem' }}>{c.instructor_name}</td>
                                        <td style={{ padding: '1rem' }}>{c.days_of_week} | {c.start_time}</td>
                                        <td style={{ padding: '1rem' }}>{c.location}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn btn-ghost btn-icon" onClick={() => deleteClass(c.id)} style={{ color: 'var(--accent-rose)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>הוספת חוג חדש</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required className="input-field" placeholder="שם החוג" value={newClass.title_he} onChange={e => setNewClass({ ...newClass, title_he: e.target.value })} />
                            <textarea className="input-field" placeholder="תיאור" style={{ height: '80px' }} value={newClass.description_he} onChange={e => setNewClass({ ...newClass, description_he: e.target.value })} />
                            <input className="input-field" placeholder="שם המדריך" value={newClass.instructor_name} onChange={e => setNewClass({ ...newClass, instructor_name: e.target.value })} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input className="input-field" placeholder="ימים (א, ב...)" value={newClass.days_of_week} onChange={e => setNewClass({ ...newClass, days_of_week: e.target.value })} />
                                <input type="time" className="input-field" value={newClass.start_time} onChange={e => setNewClass({ ...newClass, start_time: e.target.value })} />
                            </div>
                            <input className="input-field" placeholder="מיקום" value={newClass.location} onChange={e => setNewClass({ ...newClass, location: e.target.value })} />
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md">
                                {saving ? 'שומר חוג בדאטהבייס...' : 'שמור חוג בדאטהבייס'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
