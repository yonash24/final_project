'use client';

import { useActionState, startTransition } from 'react';
import { loginAdmin } from './actions';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const initialState = {
    message: null,
    error: null,
};

export default function AdminLoginPage() {
    const [state, formAction, isPending] = useActionState(loginAdmin, initialState);
    const searchParams = useSearchParams();
    const errorType = searchParams.get('error');

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
            formAction(formData);
        });
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Abstract Background elements */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ 
                    position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', 
                    borderRadius: '50%', background: 'rgba(2, 132, 199, 0.05)', filter: 'blur(100px)' 
                }} />
                <div style={{ 
                    position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', 
                    borderRadius: '50%', background: 'rgba(59, 130, 246, 0.05)', filter: 'blur(100px)' 
                }} />
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ width: '100%', maxWidth: '440px', zIndex: 10 }}
            >
                <div style={{ 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '2rem', 
                    padding: '2.5rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ 
                            width: '4rem', height: '4rem', 
                            background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)', 
                            borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            marginBottom: '1rem', boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.2)'
                        }}>
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>כניסת מנהלים</h1>
                        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>הזן פרטים כדי לגשת ללוח הבקרה</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <AnimatePresence mode="wait">
                            {(state?.message || errorType === 'unauthorized') && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    style={{ 
                                        background: '#fef2f2', 
                                        border: '1px solid #fee2e2', 
                                        color: '#ef4444', padding: '0.75rem', 
                                        borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' 
                                    }}
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{errorType === 'unauthorized' ? 'אין לך הרשאות גישה למערכת הניהול' : state.message}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>


                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginLeft: '0.25rem' }}>אימייל</label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ 
                                    position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', 
                                    width: '1.25rem', height: '1.25rem', color: '#94a3b8' 
                                }} />
                                <input 
                                    name="email"
                                    type="email" 
                                    required
                                    className="input-field"
                                    style={{ 
                                        paddingLeft: '3rem', background: '#f8fafc', 
                                        borderColor: '#e2e8f0', color: '#0f172a' 
                                    }}
                                    placeholder="admin@matnas.com" 
                                />
                            </div>
                            {state?.error?.email && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{state.error.email}</p>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginLeft: '0.25rem' }}>סיסמה</label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ 
                                    position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', 
                                    width: '1.25rem', height: '1.25rem', color: '#94a3b8' 
                                }} />
                                <input 
                                    name="password"
                                    type="password" 
                                    required
                                    className="input-field"
                                    style={{ 
                                        paddingLeft: '3rem', background: '#f8fafc', 
                                        borderColor: '#e2e8f0', color: '#0f172a' 
                                    }}
                                    placeholder="••••••••" 
                                />
                            </div>
                            {state?.error?.password && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{state.error.password}</p>}
                        </div>

                        <button 
                            type="submit"
                            disabled={isPending}
                            className="btn btn-primary btn-lg"
                            style={{ 
                                width: '100%', marginTop: '0.5rem', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                opacity: isPending ? 0.7 : 1,
                                boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.3)'
                            }}
                        >
                            {isPending ? (
                                <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <>
                                    <span>התחבר למערכת</span>
                                    <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <Link href="/" style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontWeight: 500 }}>
                            חזרה לדף הבית
                        </Link>
                    </div>
                </div>
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}


