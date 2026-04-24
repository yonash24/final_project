"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { BookOpen, Calendar, Users, Activity, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AdminPage() {
    const [stats, setStats] = useState({ classes: 0, events: 0, members: 0, posts: 0 });

    useEffect(() => {
        async function fetchStats() {
            const [classesRes, eventsRes, membersRes, postsRes] = await Promise.all([
                supabase.from('activities').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase.from('events').select('id', { count: 'exact', head: true }),
                supabase.from('members').select('id', { count: 'exact', head: true }),
                supabase.from('posts').select('id', { count: 'exact', head: true }),
            ]);
            setStats({
                classes: classesRes.count ?? 0,
                events: eventsRes.count ?? 0,
                members: membersRes.count ?? 0,
                posts: postsRes.count ?? 0,
            });
        }
        fetchStats();
    }, []);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>לוח בקרה 🚀</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>ברוך הבא למערכת הניהול. כאן תוכל לראות תמונת מצב של המתנ"ס ולגשת לכל כלי הניהול.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                    <StatCard icon={<BookOpen color="#0284c7" />} label="חוגים פעילים" value={String(stats.classes)} bg="#e0f2fe" />
                    <StatCard icon={<Calendar color="#f59e0b" />} label="אירועים" value={String(stats.events)} bg="#fef3c7" />
                    <StatCard icon={<Users color="#16a34a" />} label="משתתפים רשומים" value={String(stats.members)} bg="#dcfce7" />
                    <StatCard icon={<Activity color="#6366f1" />} label="פוסטים בפיד" value={String(stats.posts)} bg="#e0e7ff" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>פעולות מהירות</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            <QuickAction href="/admin/classes" title="ניהול חוגים" desc="הוספה, עריכה וסגירת חוגים" />
                            <QuickAction href="/admin/events" title="ניהול אירועים" desc="פרסום אירועים קהילתיים חדשים" />
                            <QuickAction href="/admin/studio" title="סטודיו שיווקי" desc="יצירת תוכן שיווקי ב-AI" />
                            <QuickAction href="/admin/members" title="ניהול משתתפים" desc="ייצוא וייבוא נתוני משתתפים" />
                            <QuickAction href="/chat" title="צפייה כתושב" desc="בדיקת ה-AI מצד המשתמש" outLink />
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>סטטוס מערכת</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span>מסד נתונים (Supabase)</span>
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>מחובר ✅</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span>מנוע AI (Gemini)</span>
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>פעיל ✅</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode, label: string, value: string, bg: string }) {
    return (
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{value}</div>
            </div>
        </div>
    );
}

function QuickAction({ href, title, desc, outLink }: { href: string, title: string, desc: string, outLink?: boolean }) {
    return (
        <Link href={href} style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {title} {outLink && <ExternalLink size={14} />}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{desc}</div>
            </div>
        </Link>
    );
}
