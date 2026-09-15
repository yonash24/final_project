'use client';

import Link from 'next/link';
import { useState } from 'react';

type ChangeRequest = {
    id: string;
    operation: 'archive' | 'restore' | 'publish';
    before_snapshot: Record<string, unknown> | null;
    proposed_changes: Record<string, unknown>;
    status: string;
    expires_at: string;
};

const OPERATION_LABELS = { archive: 'העברה לארכיון', restore: 'שחזור כטיוטה', publish: 'פרסום' };

export default function ApprovalClient({ change }: { change: ChangeRequest }) {
    const [status, setStatus] = useState(change.status);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const target = change.before_snapshot ?? {};
    const actionable = status === 'pending' && new Date(change.expires_at) > new Date();

    async function act(action: 'confirm_high_risk' | 'cancel') {
        setLoading(true); setMessage(null);
        try {
            const response = await fetch('/api/admin/activity-changes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, requestId: change.id }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה');
            setStatus(action === 'cancel' ? 'cancelled' : 'confirmed');
            setMessage(data.response);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'הפעולה נכשלה');
        } finally { setLoading(false); }
    }

    return <section className="card" style={{ padding: '2rem', maxWidth: 760 }}>
        <h1>אישור פעולה רגישה</h1>
        <p>הפעולה עדיין לא בוצעה. האישור מחייב חיבור פעיל ברמת MFA ‏(aal2).</p>
        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 12, lineHeight: 1.8 }}>
            <strong>פעולה:</strong> {OPERATION_LABELS[change.operation]}<br />
            <strong>חוג:</strong> {String(target.title_he ?? target.title ?? 'חוג ללא שם')}<br />
            <strong>סניף:</strong> {String(target.location ?? target.venue ?? 'לא צוין')}<br />
            <strong>קבוצה:</strong> {String(target.group_name ?? 'לא צוינה')}<br />
            <strong>יום ושעה:</strong> {String(target.days_of_week ?? 'לא צוינו')} {String(target.start_time ?? '')}<br />
            <strong>תוקף:</strong> {new Date(change.expires_at).toLocaleString('he-IL')}
        </div>
        {Object.keys(change.proposed_changes).length > 0 && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(change.proposed_changes, null, 2)}</pre>}
        {message && <p role="status">{message}</p>}
        {actionable ? <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" disabled={loading} onClick={() => void act('confirm_high_risk')}>{loading ? 'מבצע...' : 'אישור וביצוע'}</button>
            <button className="btn btn-secondary" disabled={loading} onClick={() => void act('cancel')}>ביטול</button>
        </div> : <p>הבקשה אינה פעילה עוד ({status}).</p>}
        <p style={{ marginTop: '1.5rem' }}><Link href="/admin/classes">חזרה לניהול חוגים</Link></p>
    </section>;
}
