import AdminNavbar from '@/components/admin/AdminNavbar';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';

export default function AdminClassesPage() {
    const classes = [
        { id: 1, title: 'רובוטיקה וקוד', category: 'טכנולוגיה', students: 12, max: 15, status: 'פעיל' },
        { id: 2, title: 'יוגה בבוקר', category: 'גוף ונפש', students: 18, max: 20, status: 'פעיל' },
        { id: 3, title: 'ציור פחם', category: 'אמנות', students: 8, max: 10, status: 'הסתיים' },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול חוגים וקורסים 📚</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>צפייה, עריכה והוספה של חוגים למערכת</p>
                    </div>
                    <button className="btn btn-primary btn-md">
                        <Plus size={18} /> הוסף חוג חדש
                    </button>
                </header>

                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '1rem' }}>שם החוג</th>
                                <th style={{ padding: '1rem' }}>קטגוריה</th>
                                <th style={{ padding: '1rem' }}>משתתפים</th>
                                <th style={{ padding: '1rem' }}>סטטוס</th>
                                <th style={{ padding: '1rem' }}>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classes.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{c.title}</td>
                                    <td style={{ padding: '1rem' }}>{c.category}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Users size={16} /> {c.students}/{c.max}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className="hero-badge" style={{ backgroundColor: c.status === 'פעיל' ? '#dcfce7' : '#fee2e2', color: c.status === 'פעיל' ? '#166534' : '#991b1b', padding: '0.25rem 0.5rem' }}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-ghost btn-icon"><Edit2 size={16} /></button>
                                            <button className="btn btn-ghost btn-icon" style={{ color: 'var(--accent-rose)' }}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
