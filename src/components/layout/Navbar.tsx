'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';

import AccessibilityControls from '@/components/public/AccessibilityControls';

const navLinks = [
    { href: '/', label: 'ראשי' },
    { href: '/start', label: 'מאיפה מתחילים?' },
    { href: '/classes', label: 'חוגים' },
    { href: '/events', label: 'אירועים' },
    { href: '/feed', label: 'פיד קהילתי' },
    { href: '/chat', label: 'דברו איתי פשוט' },
];

export default function Navbar() {
    const pathname = usePathname();
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (drawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [drawerOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    return (
        <>
            <nav className="navbar animate-fade-up" style={{ animationDelay: '0.1s' }} aria-label="ניווט ראשי">
                <Link href="/" className="nav-brand" aria-label="המתנס שלנו - דף הבית">
                    <span className="nav-brand-mark" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9.5L12 3l9 6.5" />
                            <path d="M5 10v10h14V10" />
                            <path d="M9 20v-6h6v6" />
                        </svg>
                    </span>
                    <span className="nav-brand-text">
                        המתנ&quot;ס שלנו
                        <small>קהילה דיגיטלית</small>
                    </span>
                </Link>

                <div className="nav-links">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={pathname === link.href ? 'is-active' : ''}
                            aria-current={pathname === link.href ? 'page' : undefined}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="nav-actions">
                    <AccessibilityControls />
                    <Link href="/admin" className="btn btn-secondary btn-md">
                        לצוות המתנ&quot;ס
                    </Link>
                    <button
                        className="nav-menu-btn"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="פתח תפריט"
                        aria-expanded={drawerOpen}
                    >
                        <Menu size={22} />
                    </button>
                </div>
            </nav>

            {drawerOpen && (
                <div className="nav-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
            )}
            {drawerOpen && (
                <aside className="nav-drawer" role="dialog" aria-modal="true" aria-label="תפריט ניווט">
                    <div className="nav-drawer-header">
                        <Link href="/" className="nav-brand" onClick={closeDrawer}>
                            <span className="nav-brand-mark" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9.5L12 3l9 6.5" />
                                    <path d="M5 10v10h14V10" />
                                    <path d="M9 20v-6h6v6" />
                                </svg>
                            </span>
                            <span className="nav-brand-text">
                                המתנ&quot;ס שלנו
                                <small>קהילה דיגיטלית</small>
                            </span>
                        </Link>
                        <button
                            className="nav-menu-btn"
                            onClick={closeDrawer}
                            aria-label="סגור תפריט"
                        >
                            <X size={22} />
                        </button>
                    </div>
                    <nav className="nav-drawer-links" aria-label="ניווט ראשי">
                        {navLinks.map((link, index) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={closeDrawer}
                                className={pathname === link.href ? 'is-active' : ''}
                                style={{ animationDelay: `${0.05 * (index + 1)}s` }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="nav-drawer-footer">
                        <Link href="/admin" className="btn btn-secondary btn-md" onClick={closeDrawer} style={{ width: '100%' }}>
                            לצוות המתנ&quot;ס
                        </Link>
                    </div>
                </aside>
            )}
        </>
    );
}
