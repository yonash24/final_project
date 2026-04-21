"use client";
import Navbar from '@/components/layout/Navbar';
import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function FeedPage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (data) setPosts(data);
        setLoading(false);
    }

    return (
        <div style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '3rem' }}>
            <div className="container">
                <Navbar />

                <main style={{ padding: '2rem 0', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>פיד קהילתי 🏠</h1>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>טוען עדכונים מהדאטהבייס...</div>
                        ) : posts.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>עוד לא פורסמו הודעות בפיד הקהילתי.</div>
                        ) : posts.map((post, idx) => (
                            <div key={post.id} className="card animate-fade-up" style={{ animationDelay: `${0.1 * idx}s` }}>
                                <div className="card-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {post.author_name?.charAt(0) || 'A'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{post.author_name}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                <span style={{ color: post.author_role === 'admin' ? 'var(--accent-primary)' : 'inherit', fontWeight: post.author_role === 'admin' ? 'bold' : 'normal' }}>
                                                    {post.author_role === 'admin' ? 'רשמי' : 'תושב'}
                                                </span> • {new Date(post.created_at).toLocaleDateString('he-IL')}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-icon"><MoreHorizontal size={20} /></button>
                                </div>

                                <div className="card-content" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                    {post.title && <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{post.title}</h3>}
                                    <div style={{ fontSize: '1.05rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                                        {post.content}
                                    </div>
                                </div>

                                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '2rem' }}>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: 0, gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <Heart size={20} /> {post.likes_count || 0}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: 0, gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <MessageCircle size={20} /> תגובות
                                    </button>
                                </div>
                            </div>
                        ))}

                    </div>
                </main>
            </div>
        </div>
    );
}
