"use client";

import { Send, Trash2, Megaphone, X, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { AdminPost } from '@/lib/admin/types';

interface PostFormState {
    title: string;
    content: string;
}

const EMPTY_POST: PostFormState = { title: '', content: '' };

export default function AdminFeedPage() {
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingPost, setEditingPost] = useState<AdminPost | null>(null);
    const [postForm, setPostForm] = useState<PostFormState>(EMPTY_POST);

    async function loadPosts() {
        const response = await fetch('/api/admin/posts');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch posts');
        return data as AdminPost[];
    }

    async function refreshData() {
        setLoading(true);
        try {
            setPosts(await loadPosts());
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let ignore = false;

        void (async () => {
            setLoading(true);
            try {
                const data = await loadPosts();
                if (!ignore) {
                    setPosts(data);
                }
            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, []);

    function openCreateModal() {
        setEditingPost(null);
        setPostForm(EMPTY_POST);
        setShowModal(true);
    }

    function openEditModal(post: AdminPost) {
        setEditingPost(post);
        setPostForm({
            title: post.title ?? '',
            content: post.content,
        });
        setShowModal(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);

        try {
            const response = await fetch(
                editingPost ? `/api/admin/posts/${editingPost.id}` : '/api/admin/posts',
                {
                    method: editingPost ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postForm),
                },
            );

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save post');

            setShowModal(false);
            setEditingPost(null);
            setPostForm(EMPTY_POST);
            await refreshData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בשמירה';
            alert(message);
        } finally {
            setSaving(false);
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
            await refreshData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה במחיקה';
            alert(message);
            setLoading(false);
        }
    }

    return (
        <div className="admin-root">
            <AdminNavbar />
            <main className="admin-container" id="main-content">
                <header className="admin-page-header">
                    <div>
                        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.5rem' }}>ניהול פיד קהילתי 📢</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>עריכת פוסטים קיימים ופרסום עדכונים חדשים בצורה עקבית.</p>
                    </div>
                    <button onClick={openCreateModal} className="btn btn-primary btn-md">
                        <Megaphone size={18} /> פרסם הודעה חדשה
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>טוען הודעות...</div>
                    ) : posts.length === 0 ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין הודעות בפיד. צור הודעה חדשה!</div>
                    ) : posts.map((post) => (
                        <div key={post.id} className="card admin-section-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
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
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(post)} style={{ backgroundColor: 'var(--primary-50)' }} title="ערוך פוסט">
                                        <Pencil size={16} color="var(--primary-600)" />
                                    </button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => deletePost(post.id)} style={{ color: 'var(--accent-rose)', backgroundColor: 'var(--error-100)' }} title="מחק פוסט">
                                        <Trash2 size={18} color="var(--error-600)" />
                                    </button>
                                </div>
                            </div>
                            {post.title && <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{post.title}</h3>}
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-secondary)' }}>{post.content}</div>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(13,27,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '560px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <div>
                                <h2>{editingPost ? 'עריכת הודעה' : 'פרסום הודעה חדשה'}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>הפוסט יתעדכן מייד בפיד הציבורי.</p>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="סגור">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>כותרת ההודעה</label>
                                <input
                                    className="input-field"
                                    placeholder="למשל: עדכון חשוב למשתתפי החוג"
                                    value={postForm.title}
                                    onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>תוכן ההודעה</label>
                                <textarea
                                    required
                                    className="input-field"
                                    placeholder="כתבו כאן את התוכן המלא..."
                                    style={{ height: '170px', paddingTop: '0.8rem' }}
                                    value={postForm.content}
                                    onChange={(event) => setPostForm((prev) => ({ ...prev, content: event.target.value }))}
                                />
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-md" style={{ gap: '0.5rem' }}>
                                {saving ? 'שומר...' : <><Send size={18} /> {editingPost ? 'שמור שינויים' : 'שמור ופרסם'}</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
