import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import AccessibilityControls from '@/components/public/AccessibilityControls';

export default function Navbar() {
    return (
        <nav className="navbar animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <Link href="/" className="nav-brand">
                <Sparkles size={32} />
                <span>המתנ&quot;ס שלנו</span>
            </Link>

            <div className="nav-links">
                <Link href="/">ראשי</Link>
                <Link href="/start">מאיפה מתחילים?</Link>
                <Link href="/classes">חוגים</Link>
                <Link href="/events">אירועים</Link>
                <Link href="/feed">פיד קהילתי</Link>
                <Link href="/chat">דברו איתי פשוט</Link>
            </div>

            <div className="nav-actions">
                <AccessibilityControls />
                <Link href="/admin/login" className="btn btn-secondary btn-md">
                    לצוות המתנ&quot;ס
                </Link>
            </div>
        </nav>
    );
}
