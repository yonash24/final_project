import Link from 'next/link';
import { LayoutDashboard, BookOpen, Calendar, Users, Settings, LogOut, Sparkles, Megaphone, Palette } from 'lucide-react';

export default function AdminNavbar() {
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
                    <span>ניהול מתנ"ס</span>
                </Link>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <NavLink href="/admin/classes" icon={<BookOpen size={18} />} label="חוגים וקורסים" />
                    <NavLink href="/admin/events" icon={<Calendar size={18} />} label="אירועים" />
                    <NavLink href="/admin/feed" icon={<Megaphone size={18} />} label="פיד קהילתי" />
                    <NavLink href="/admin/studio" icon={<Palette size={18} />} label="סטודיו גנרטיבי" />
                    <NavLink href="/admin/members" icon={<Users size={18} />} label="משתתפים" />
                    <NavLink href="/admin/settings" icon={<Settings size={18} />} label="הגדרות" />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'left', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 'bold' }}>מנהל מערכת</div>
                    <div style={{ color: 'var(--text-secondary)' }}>admin@matnas.com</div>
                </div>
                <Link href="/admin/login" className="btn btn-ghost btn-icon">
                    <LogOut size={20} />
                </Link>
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
