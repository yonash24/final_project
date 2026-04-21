import Link from 'next/link';

export default function AdminLoginPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.75rem' }}>כניסת מנהלים</h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>אימייל</label>
                        <input type="email" className="input-field" placeholder="admin@matnas.com" />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>סיסמה</label>
                        <input type="password" className="input-field" placeholder="••••••••" />
                    </div>

                    <Link href="/admin" className="btn btn-primary btn-md" style={{ marginTop: '1rem', width: '100%' }}>
                        התחבר למערכת
                    </Link>

                    <Link href="/" className="btn btn-ghost btn-md" style={{ alignSelf: 'center', marginTop: '0.5rem' }}>
                        חזרה לאתר
                    </Link>
                </div>
            </div>
        </div>
    );
}
