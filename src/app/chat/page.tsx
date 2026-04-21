import Link from 'next/link';

export default function ChatPage() {
    return (
        <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav className="navbar">
                <div className="nav-brand">צ'אט חכם</div>
                <Link href="/" className="btn btn-secondary btn-md">חזרה לעמוד הראשי</Link>
            </nav>
            <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
                <h1 style={{ fontSize: '3rem' }}>שיחה עם נציג ה-AI (בבנייה)</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>עמוד יעודי זה ייבנה בחלק 3 של התוכנית שלנו ויאפשר שיח טבעי מול מסד הנתונים.</p>

                <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
                    <div className="input-field" style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                        שאל אותי משהו כמו: "יש חוג ציור בטווח גילאים של 6-8 ביום ראשון?"
                    </div>
                </div>
            </main>
        </div>
    );
}
