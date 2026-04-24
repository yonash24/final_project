"use client";
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Palette, Sparkles, Send, Copy, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function StudioPage() {
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState<'post' | 'flyer'>('post');
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setResult('');
        setCopied(false);
        try {
            const res = await fetch('/api/studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type }),
            });
            const data = await res.json();
            if (data.content) setResult(data.content);
        } catch (e) {
            console.error(e);
            setResult('אירעה שגיאה. נסה שוב מאוחר יותר.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0', maxWidth: '1000px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Palette size={40} color="var(--accent-primary)" />
                    סטודיו שיווק גנרטיבי
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.2rem' }}>
                    בלחיצת כפתור, מנוע ה-AI יכתוב עבורך תוכן שיווקי מרהיב לחוגים ואירועים.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Input Section */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={20} color="var(--accent-secondary)" />
                            מה נרצה לפרסם היום?
                        </h3>

                        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button
                                className={`btn ${type === 'post' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setType('post')}
                                style={{ flex: 1 }}
                            >
                                <Send size={18} /> פוסט לרשתות
                            </button>
                            <button
                                className={`btn ${type === 'flyer' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setType('flyer')}
                                style={{ flex: 1 }}
                            >
                                <Palette size={18} /> טקסט לפלייר
                            </button>
                        </div>

                        <textarea
                            className="input-field"
                            style={{ height: '200px', resize: 'none', padding: '1rem', marginBottom: '1.5rem' }}
                            placeholder='ספר לי על החוג או האירוע... למשל: "חוג לגו הנדסי חדש ביום שלישי ב-16:00, מתאים לגילאי 6-10, מלמד פיזיקה דרך משחק וכיף"'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%' }}
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                        >
                            {isLoading ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                            {isLoading ? 'מייצר קסמים...' : 'חולל תוכן שיווקי'}
                        </button>
                    </div>

                    {/* Result Section */}
                    <div className="card" style={{ padding: '2rem', background: 'linear-gradient(145deg, #ffffff, #f0fdf4)', border: '2px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>התוצאה שלך</h3>
                            {result && (
                                <button className="btn btn-ghost" onClick={handleCopy} title="העתק טקסט" style={{ padding: '0.5rem', height: 'auto' }}>
                                    {copied ? <CheckCircle2 color="#16a34a" /> : <Copy />}
                                </button>
                            )}
                        </div>

                        <div
                            style={{
                                background: 'white',
                                borderRadius: 'var(--radius-md)',
                                padding: '1.5rem',
                                minHeight: '300px',
                                border: '1px solid var(--border-color)',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'inherit',
                                lineHeight: '1.8'
                            }}
                        >
                            {isLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                    <Sparkles className="animate-pulse" size={40} style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }} />
                                    <span>AI בעבודה... מנסח רעיונות...</span>
                                </div>
                            ) : result ? (
                                <div>{result}</div>
                            ) : (
                                <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '100px' }}>
                                    התוכן הגנרטיבי יופיע כאן ✨
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
