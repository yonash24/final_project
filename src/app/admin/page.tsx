import Link from 'next/link';

export default function AdminDashboardPage() {
    return (
        <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav className="navbar" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <div className="nav-brand">פאנל ניהול המתנ"ס</div>
                <Link href="/" className="btn btn-secondary btn-md">חזרה לאתר</Link>
            </nav>

            <main>
                <h1 style={{ marginBottom: '2rem' }}>שלום מנהל (בבנייה)</h1>

                <div className="features-grid" style={{ gridTemplateColumns: 'repeat(1, 1fr)', maxWidth: 'none', padding: 0 }}>
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">לוח בקרה</h2>
                        </div>
                        <div className="card-content">
                            <p>כאן תוכל לנהל את החוגים, הפעילויות והמשתתפים של המתנ"ס.</p>
                            <br />
                            <p><strong>חלק 2 (ניהול Database) נמצא בפיתוח ברגע זה.</strong></p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
