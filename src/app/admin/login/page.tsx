import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '2rem',
                    padding: '2.5rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        width: '4rem',
                        height: '4rem',
                        margin: '0 auto 1rem',
                        borderRadius: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)',
                        boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.2)',
                    }}
                >
                    <ShieldCheck className="w-8 h-8 text-white" />
                </div>

                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
                    כניסת מנהלים
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>
                    אזור הניהול פתוח. לחץ כדי להיכנס ישירות ללוח הבקרה.
                </p>

                <Link
                    href="/admin"
                    className="btn btn-primary btn-lg"
                    style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        textDecoration: 'none',
                    }}
                >
                    <span>כניסה ללוח הבקרה</span>
                    <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                </Link>
            </div>
        </div>
    );
}
