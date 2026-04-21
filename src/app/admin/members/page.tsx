"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Search, Mail, Phone, UserPlus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminMembersPage() {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [newMember, setNewMember] = useState({ full_name: '', email: '', phone: '' });

    useEffect(() => {
        fetchMembers();
    }, []);

    async function fetchMembers() {
        setLoading(true);
        const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
        if (data) setMembers(data);
        if (error) console.error('Error fetching members:', error);
        setLoading(false);
    }

    async function handleAddMember(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('members').insert([newMember]);
        if (!error) {
            setShowModal(false);
            setNewMember({ full_name: '', email: '', phone: '' });
            fetchMembers();
        } else {
            alert('שגיאה בהוספת משתתף: ' + error.message);
        }
    }

    async function deleteMember(id: string) {
        if (confirm('האם למחוק משתתף זה?')) {
            const { error } = await supabase.from('members').delete().eq('id', id);
            if (!error) fetchMembers();
            else alert('שגיאה במחיקה: ' + error.message);
        }
    }

    const filtered = members.filter(m =>
        m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.includes(search)
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול משתתפים 👥</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>בסיס הנתונים של תושבי הקהילה ({members.length} רשומים)</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <UserPlus size={18} /> הוסף משתתף
                    </button>
                </header>

                <div className="card">
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                            <Search size={18} color="var(--text-secondary)" />
                            <input
                                type="text"
                                placeholder="חפש לפי שם, אימייל או טלפון..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                            />
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>טוען משתתפים...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '1rem' }}>שם המשתתף</th>
                                    <th style={{ padding: '1rem' }}>פרטי קשר</th>
                                    <th style={{ padding: '1rem' }}>תאריך הצטרפות</th>
                                    <th style={{ padding: '1rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {search ? 'לא נמצאו תוצאות' : 'אין משתתפים רשומים עדיין'}
                                    </td></tr>
                                ) : filtered.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{m.full_name}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.875rem' }}>
                                                {m.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} /> {m.email}</div>}
                                                {m.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} /> {m.phone}</div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{m.join_date ? new Date(m.join_date).toLocaleDateString('he-IL') : '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <button className="btn btn-ghost btn-icon" onClick={() => deleteMember(m.id)} style={{ color: 'var(--accent-rose)' }}><Trash2 size={16} /></button>
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
                    <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>הוספת משתתף חדש</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required className="input-field" placeholder="שם מלא" value={newMember.full_name} onChange={e => setNewMember({ ...newMember, full_name: e.target.value })} />
                            <input type="email" className="input-field" placeholder="אימייל" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} />
                            <input className="input-field" placeholder="טלפון" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} />
                            <button type="submit" className="btn btn-primary btn-md">שמור משתתף</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
