import AdminNavbar from '@/components/admin/AdminNavbar';
import { Calendar, MapPin, Plus, Trash2, Edit2 } from 'lucide-react';

export default function AdminEventsPage() {
    const events = [
        { id: 1, title: 'הפנינג פתיחת הקיץ', date: '21.06.2026', location: 'רחבה מרכזית', attendees: 450 },
        { id: 2, title: 'הרצאת תזונה', date: '05.07.2026', location: 'אולם כנסים', attendees: 32 },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול אירועים 📅</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>ניהול לוח האירועים הקהילתי</p>
                    </div>
                    <button className="btn btn-primary btn-md">
                        <Plus size={18} /> צור אירוע חדש
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {events.map(e => (
                        <div key={e.id} className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '80px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{e.date.split('.')[0]}</span><br />
                                    <span style={{ fontSize: '0.875rem' }}>{e.date.split('.')[1]}.{e.date.split('.')[2]}</span>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{e.title}</h3>
                                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={16} /> {e.location}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>👥 {e.attendees} נרשמו</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary btn-md">צפה בנרשמים</button>
                                <button className="btn btn-ghost btn-icon"><Edit2 size={16} /></button>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'var(--accent-rose)' }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
