'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useActionState } from 'react';

import { loginAdmin, type LoginState } from './actions';

export default function AdminLoginPage() {
    const [state, action, pending] = useActionState<LoginState, FormData>(loginAdmin, { message: null, error: null });

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
                <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>היכנסו עם חשבון מנהל מורשה.</p>

                <form action={action} style={{ display: 'grid', gap: '1rem', textAlign: 'start' }}>
                    <label>
                        אימייל
                        <input name="email" type="email" autoComplete="email" required style={{ width: '100%', marginTop: '0.35rem' }} />
                    </label>
                    {state.error?.email && <small style={{ color: '#b91c1c' }}>{state.error.email[0]}</small>}
                    <label>
                        סיסמה
                        <input name="password" type="password" autoComplete="current-password" required style={{ width: '100%', marginTop: '0.35rem' }} />
                    </label>
                    {state.error?.password && <small style={{ color: '#b91c1c' }}>{state.error.password[0]}</small>}
                    {state.message && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{state.message}</p>}
                    <button type="submit" disabled={pending} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                        {pending ? 'מתחבר...' : 'כניסה ללוח הבקרה'}
                    </button>
                </form>

                <Link href="/" className="btn btn-lg" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none', marginTop: '1rem' }}>
                    <span>חזרה לאתר</span>
                    <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                </Link>
            </div>
        </div>
    );
}
