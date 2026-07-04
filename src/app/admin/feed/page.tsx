"use client";

import { Send, Trash2, Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { AdminPost } from '@/lib/admin/types';

export default function AdminFeedPage() {
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '' });

    async function loadPosts() {
        const response = await fetch('/api/admin/posts');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch posts');
        return data as AdminPost[];
    }

    useEffect(() => {
        let ignore = false;
        void loadPosts()
            .then((data) => {
                if (!ignore) setPosts(data);
            })
            .catch((error) => {
                console.error('Error fetching posts:', error);
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setLoading(true);

        try {
            const response = await fetch('/api/admin/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save post');

            setShowModal(false);
            setNewPost({ title: '', content: '' });
            setPosts(await loadPosts());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירה';
            alert(message);
        } finally {
            setSaving(false);
            setLoading(false);
        }
    }

    async function deletePost(id: string) {
        if (!confirm('האם למחוק פוסט זה?')) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Delete failed');
            }
            setPosts(await loadPosts());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה במחיקה';
            alert(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול פיד קהילתי 📢</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>פרסום הודעות ועדכונים חשובים דרך API מאובטח</p>
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
                    ) : posts.map((post) => (
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
                                    onChange={(event) => setNewPost((prev) => ({ ...prev, title: event.target.value }))}
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
                                    onChange={(event) => setNewPost((prev) => ({ ...prev, content: event.target.value }))}
                                />
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md" style={{ gap: '0.5rem' }}>
                                {saving ? 'שומר...' : <><Send size={18} /> שמור ופרסם</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
