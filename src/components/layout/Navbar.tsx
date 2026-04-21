import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="navbar animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <Link href="/" className="nav-brand">
                <Sparkles size={32} />
                <span>מרכז דיגיטלי</span>
            </Link>

            <div className="nav-links">
                <Link href="/">ראשי</Link>
                <Link href="/classes">חוגים</Link>
                <Link href="/events">אירועים</Link>
                <Link href="/feed">פיד קהילתי</Link>
                <Link href="/chat">צ'אט מתנ"ס</Link>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <Link href="/admin/login" className="btn btn-secondary btn-md">
                    כניסת מנהלים
                </Link>
            </div>
        </nav>
    );
}
