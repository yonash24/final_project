'use client';

import { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';

type Activity = {
    id: string;
    title_he?: string;
    location?: string | null;
    days_of_week?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    min_age?: number | null;
    max_age?: number | null;
    price?: number | null;
    instructor_name?: string | null;
};
type Pending = { token: string; response: string; operation: string; target?: Activity; changes: Record<string, unknown> };
type Message = { role: 'user' | 'assistant'; text: string; activityCards?: Activity[]; selectionPrefix?: string };

function ActivityChoices({ activities, onChoose }: { activities: Activity[]; onChoose: (activity: Activity) => void }) {
    if (!activities.length) return null;
    return <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
        {activities.map((activity) => <button key={activity.id} type="button" className="btn btn-secondary" onClick={() => onChoose(activity)} style={{ textAlign: 'start' }}>
            <strong>{activity.title_he || 'חוג ללא שם'}</strong>
            {' · '}{activity.location || 'סניף לא צוין'}
            {' · '}{activity.days_of_week || 'יום לא צוין'}
            {activity.start_time ? ` ${activity.start_time.slice(0, 5)}` : ''}
            {activity.end_time ? `–${activity.end_time.slice(0, 5)}` : ''}
            {' · גיל '}{activity.min_age ?? 'לא צוין'}{'–'}{activity.max_age ?? 'לא צוין'}
        </button>)}
    </div>;
}

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
            setMessages((items) => [...items, { role: 'assistant', text: data.response, activityCards: data.activityCards ?? [], selectionPrefix: message }]);
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
                {messages.map((message, index) => <div key={index} style={{ padding: '0.8rem', borderRadius: 12, background: message.role === 'user' ? 'var(--primary-50)' : 'var(--bg-secondary)' }}>
                    <div>{message.text}</div>
                    {message.activityCards && <ActivityChoices activities={message.activityCards} onChoose={(activity) => setInput(`${message.selectionPrefix ?? 'בחר את החוג'} מזהה חוג ${activity.id}`)} />}
                </div>)}
            </div>
            {pending && <div role="alert" style={{ border: '2px solid var(--warning-500)', padding: '1rem', borderRadius: 12, marginBlock: '1rem' }}>
                <strong>הפעולה טרם בוצעה</strong>
                <div>פעולה: {pending.operation} | חוג: {pending.target?.title_he || String(pending.changes.title_he || 'חדש')}</div>
                {pending.target && <div style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
                    סניף/מיקום: {pending.target.location || 'לא צוין'} · יום: {pending.target.days_of_week || 'לא צוין'} · שעה: {pending.target.start_time?.slice(0, 5) || 'לא צוין'}–{pending.target.end_time?.slice(0, 5) || 'לא צוין'}<br />
                    גיל: {pending.target.min_age ?? 'לא צוין'}–{pending.target.max_age ?? 'לא צוין'} · מחיר: {pending.target.price ?? 'לא צוין'} · מדריך: {pending.target.instructor_name || 'לא צוין'}
                </div>}
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(pending.changes, null, 2)}</pre>
                <button className="btn btn-primary" onClick={confirm} disabled={loading}>אני מאשר/ת את הפעולה המדויקת</button>{' '}
                <button className="btn btn-secondary" onClick={() => setPending(null)}>ביטול</button>
            </div>}
            <div style={{ display: 'flex', gap: '0.75rem' }}><input className="input-field" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} placeholder="למשל: שנה את מחיר חוג הקרמיקה ל-120" /><button className="btn btn-primary" onClick={send} disabled={loading}>שליחה</button></div>
        </section>
    </main></div>;
}
