"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Calendar, Users, Settings, LogOut, Megaphone, Palette, Upload, LogIn } from 'lucide-react';
import { logoutAdmin } from '@/app/admin/login/actions';
import { useState, useEffect } from 'react';

const navItems = [
    { href: '/admin/classes', icon: BookOpen, label: 'חוגים וקורסים' },
    { href: '/admin/events', icon: Calendar, label: 'אירועים' },
    { href: '/admin/feed', icon: Megaphone, label: 'פיד קהילתי' },
    { href: '/admin/studio', icon: Palette, label: 'סטודיו גנרטיבי' },
    { href: '/admin/classes/import', icon: Upload, label: 'ייבוא חוגים' },
    { href: '/admin/members', icon: Users, label: 'משתתפים' },
    { href: '/admin/settings', icon: Settings, label: 'הגדרות' },
];

export default function AdminNavbar() {
    const pathname = usePathname();
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
        <nav className="admin-navbar" aria-label="ניווט ניהול">
            <Link href="/admin" className="admin-nav-brand">
                <span className="admin-nav-brand-mark" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9.5L12 3l9 6.5" />
                        <path d="M5 10v10h14V10" />
                        <path d="M9 20v-6h6v6" />
                    </svg>
                </span>
                <span>ניהול מתנ&quot;ס</span>
            </Link>

            <div className="admin-nav-links">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={isActive ? 'is-active' : ''}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon size={16} aria-hidden="true" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ textAlign: 'end', fontSize: 'var(--text-xs)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>מנהל מערכת</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{userEmail || 'מתחבר...'}</div>
                </div>

                <form action={logoutAdmin}>
                    <button type="submit" className="admin-icon-btn" aria-label="התנתק" title="התנתק">
                        <LogOut size={18} />
                    </button>
                </form>
            </div>
        </nav>
    );
}
