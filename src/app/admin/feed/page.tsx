"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Send, Trash2, MessageSquare, Megaphone, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminFeedPage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newPost, setNewPost] = useState({ content: '', author_role: 'admin' });

    useEffect(() => {
        fetchPosts();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (data) setPosts(data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('posts').insert([
            {
                content: newPost.content,
                author_name: 'הנהלת המתנ"ס',
                author_role: 'admin'
            }
        ]);
        if (!error) {
            setShowModal(false);
            setNewPost({ content: '', author_role: 'admin' });
            fetchPosts();
        }
    }

    async function deletePost(id: string) {
        if (confirm('האם למחוק פוסט זה?')) {
            await supabase.from('posts').delete().eq('id', id);
            fetchPosts();
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ניהול פיד קהילתי 📢</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>פרסום הודעות ועדכונים חשובים לכל התושבים</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                        <Megaphone size={18} /> פרסם הודעה חדשה
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
                    {posts.map(post => (
                        <div key={post.id} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {post.author_name.charAt(0)}
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
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{post.content}</div>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>פרסום הודעה חדשה</h2>
                            <X style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <textarea
                                required
                                className="input-field"
                                placeholder="מה תרצו להגיד לקהילה?..."
                                style={{ height: '150px', paddingTop: '0.8rem' }}
                                value={newPost.content}
                                onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                            />
                            <button type="submit" className="btn btn-primary btn-md" style={{ gap: '0.5rem' }}>
                                <Send size={18} /> שלח הודעה לפיד
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
