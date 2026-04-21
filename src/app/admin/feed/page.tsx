"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Send, Trash2, Megaphone, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminFeedPage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '' });

    useEffect(() => {
        fetchPosts();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (data) setPosts(data);
        if (error) console.error('Error fetching posts:', error);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        // Explicit save to database
        const { data, error } = await supabase.from('posts').insert([
            {
                title: newPost.title,
                content: newPost.content,
                author_name: 'הנהלת המתנ"ס',
                author_role: 'admin'
            }
        ]).select();

        setSaving(false);

        if (!error) {
            alert('✅ הפוסט נשמר בהצלחה בבסיס הנתונים!');
            setShowModal(false);
            setNewPost({ title: '', content: '' });
            fetchPosts();
        } else {
            console.error('DB Error:', error);
            alert('❌ שגיאה בשמירה לדאטהבייס: ' + error.message);
        }
    }

    async function deletePost(id: string) {
        if (confirm('האם למחוק פוסט זה? פעולה זו היא סופית בבסיס הנתונים.')) {
            const { error } = await supabase.from('posts').delete().eq('id', id);
            if (!error) fetchPosts();
            else alert('שגיאה במחיקה: ' + error.message);
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול פיד קהילתי 📢</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>פרסום הודעות ועדכונים חשובים השמורים במסד הנתונים</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <Megaphone size={18} /> פרסם הודעה חדשה
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>טוען הודעות...</div>
                    ) : posts.length === 0 ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין הודעות בפיד. צור הודעה חדשה!</div>
                    ) : posts.map(post => (
                        <div key={post.id} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {post.author_name?.charAt(0) || 'A'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{post.author_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {new Date(post.created_at).toLocaleString('he-IL')}
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => deletePost(post.id)} style={{ color: 'var(--accent-rose)' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            {post.title && <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{post.title}</h3>}
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-secondary)' }}>{post.content}</div>
                            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#ccc', textAlign: 'left' }}>ID: {post.id}</div>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>פרסום הודעה חדשה</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>כותרת ההודעה</label>
                                <input
                                    required
                                    className="input-field"
                                    placeholder="למשל: עדכון דחוף לגבי חופשת הפסח"
                                    value={newPost.title}
                                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>תוכן ההודעה</label>
                                <textarea
                                    required
                                    className="input-field"
                                    placeholder="כתבו כאן את התוכן המלא..."
                                    style={{ height: '150px', paddingTop: '0.8rem' }}
                                    value={newPost.content}
                                    onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                                />
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md" style={{ gap: '0.5rem' }}>
                                {saving ? 'שומר בדאטהבייס...' : <><Send size={18} /> שמור ופרסם לדאטהבייס</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
