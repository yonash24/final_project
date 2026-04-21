import AdminNavbar from '@/components/admin/AdminNavbar';
import { Search, Mail, Phone, MoreHorizontal, UserPlus } from 'lucide-react';

export default function AdminMembersPage() {
    const members = [
        { id: 1, name: 'אבי כהן', email: 'avi@gmail.com', phone: '052-1234567', classes: 2, joinDate: '12.01.2024' },
        { id: 2, name: 'שרה לוי', email: 'sara@walla.co.il', phone: '054-9876543', classes: 1, joinDate: '15.02.2024' },
        { id: 3, name: 'יוסי מזרחי', email: 'yossi@outlook.com', phone: '050-5554433', classes: 3, joinDate: '01.03.2024' },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול משתתפים 👥</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>בסיס הנתונים של תושבי הקהילה והנרשמים</p>
                    </div>
                    <button className="btn btn-primary btn-md">
                        <UserPlus size={18} /> הוסף משתתף
                    </button>
                </header>

                <div className="card">
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                            <Search size={18} color="var(--text-secondary)" />
                            <input type="text" placeholder="חפש משתתף לפי שם, אימייל או טלפון..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }} />
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '1rem' }}>שם המשתתף</th>
                                <th style={{ padding: '1rem' }}>פרטי קשר</th>
                                <th style={{ padding: '1rem' }}>חוגים פעילים</th>
                                <th style={{ padding: '1rem' }}>תאריך הצטרפות</th>
                                <th style={{ padding: '1rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 'bold' }}>{m.name}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.875rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} /> {m.email}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} /> {m.phone}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{m.classes}</td>
                                    <td style={{ padding: '1rem' }}>{m.joinDate}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <button className="btn btn-ghost btn-icon"><MoreHorizontal size={20} /></button>
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
