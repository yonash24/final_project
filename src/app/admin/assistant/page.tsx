'use client';

import { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';

type Pending = { token: string; response: string; operation: string; target?: { title_he?: string; location?: string | null }; changes: Record<string, unknown> };
type Message = { role: 'user' | 'assistant'; text: string };

export default function AdminAssistantPage() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [pending, setPending] = useState<Pending | null>(null);
    const [loading, setLoading] = useState(false);

    async function send() {
        const message = input.trim();
        if (!message || loading) return;
        setMessages((items) => [...items, { role: 'user', text: message }]);
        setInput(''); setLoading(true); setPending(null);
        try {
            const response = await fetch('/api/admin/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'הבקשה נכשלה');
            setMessages((items) => [...items, { role: 'assistant', text: data.response }]);
            if (data.responseType === 'confirmation') setPending(data);
        } catch (error) { setMessages((items) => [...items, { role: 'assistant', text: error instanceof Error ? error.message : 'שגיאה זמנית' }]); }
        finally { setLoading(false); }
    }

    async function confirm() {
        if (!pending || loading) return;
        setLoading(true);
        try {
            const response = await fetch('/api/admin/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', token: pending.token }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'האישור נכשל');
            setMessages((items) => [...items, { role: 'assistant', text: data.response }]); setPending(null);
        } catch (error) { setMessages((items) => [...items, { role: 'assistant', text: error instanceof Error ? error.message : 'שגיאה זמנית' }]); }
        finally { setLoading(false); }
    }

    return <div className="admin-root"><AdminNavbar /><main className="admin-container" id="main-content">
        <header className="admin-page-header"><div><h1>עוזר ניהולי בטוח</h1><p>חיפוש בשפה טבעית והצעות שינוי המחייבות אישור מפורש.</p></div></header>
        <section className="card" style={{ padding: '1.5rem', maxWidth: 900 }}>
            <div aria-live="polite" style={{ minHeight: 260, display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
                {messages.map((message, index) => <div key={index} style={{ padding: '0.8rem', borderRadius: 12, background: message.role === 'user' ? 'var(--primary-50)' : 'var(--bg-secondary)' }}>{message.text}</div>)}
            </div>
            {pending && <div role="alert" style={{ border: '2px solid var(--warning-500)', padding: '1rem', borderRadius: 12, marginBlock: '1rem' }}>
                <strong>הפעולה טרם בוצעה</strong><div>פעולה: {pending.operation} | חוג: {pending.target?.title_he || String(pending.changes.title_he || 'חדש')}</div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(pending.changes, null, 2)}</pre>
                <button className="btn btn-primary" onClick={confirm} disabled={loading}>אני מאשר/ת את הפעולה המדויקת</button>{' '}
                <button className="btn btn-secondary" onClick={() => setPending(null)}>ביטול</button>
            </div>}
            <div style={{ display: 'flex', gap: '0.75rem' }}><input className="input-field" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} placeholder="למשל: שנה את מחיר חוג הקרמיקה ל-120" /><button className="btn btn-primary" onClick={send} disabled={loading}>שליחה</button></div>
        </section>
    </main></div>;
}
