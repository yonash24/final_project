"use client";
import Link from 'next/link';
import { BookOpen, Calendar, Users, Settings, LogOut, Sparkles, Megaphone, Palette, Upload } from 'lucide-react';
import { logoutAdmin } from '@/app/admin/login/actions';
import { useState, useEffect } from 'react';

export default function AdminNavbar() {
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        async function getUser() {
            try {
                const response = await fetch('/api/admin/me');
                if (!response.ok) return;
                const data = await response.json();
                setUserEmail(data.email ?? null);
            } catch (error) {
                console.error('Failed to fetch admin profile', error);
            }
        }
        getUser();
    }, []);

    return (
        <nav className="glass-panel" style={{
            margin: '1.5rem',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: 'var(--radius-full)',
            position: 'sticky',
            top: '1.5rem',
            zIndex: 100,
            backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.25rem' }}>
                    <Sparkles />
                    <span>ניהול מתנ&quot;ס</span>
                </Link>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <NavLink href="/admin/classes" icon={<BookOpen size={18} />} label="חוגים וקורסים" />
                    <NavLink href="/admin/events" icon={<Calendar size={18} />} label="אירועים" />
                    <NavLink href="/admin/feed" icon={<Megaphone size={18} />} label="פיד קהילתי" />
                    <NavLink href="/admin/studio" icon={<Palette size={18} />} label="סטודיו גנרטיבי" />
                    <NavLink href="/admin/classes/import" icon={<Upload size={18} />} label="ייבוא חוגים" />
                    <NavLink href="/admin/members" icon={<Users size={18} />} label="משתתפים" />
                    <NavLink href="/admin/settings" icon={<Settings size={18} />} label="הגדרות" />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'left', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 'bold' }}>מנהל מערכת</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{userEmail || 'מתחבר...'}</div>
                </div>

                <form action={logoutAdmin}>
                    <button type="submit" className="btn btn-ghost btn-icon">
                        <LogOut size={20} />
                    </button>
                </form>

            </div>

        </nav>
    );
}

function NavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
    return (
        <Link href={href} className="btn btn-ghost btn-md" style={{ gap: '0.5rem', fontWeight: 600 }}>
            {icon}
            <span>{label}</span>
        </Link>
    );
}
