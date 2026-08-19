'use client';

import { useActionState } from 'react';

import { verifyMfa, type MfaState } from '../actions';

export default function MfaForm({ factorId, challengeId }: { factorId: string; challengeId: string }) {
    const [state, action, pending] = useActionState<MfaState, FormData>(verifyMfa, { error: null });

    return (
        <main style={{ maxWidth: 420, margin: '8rem auto', padding: '2rem', textAlign: 'center' }}>
            <h1>אימות דו-שלבי</h1>
            <p>הזינו את הקוד מאפליקציית האימות.</p>
            <form action={action} style={{ display: 'grid', gap: '1rem' }}>
                <input type="hidden" name="factorId" value={factorId} />
                <input type="hidden" name="challengeId" value={challengeId} />
                <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" aria-label="קוד אימות" />
                {state.error && <p role="alert" style={{ color: '#b91c1c' }}>{state.error}</p>}
                <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'מאמת...' : 'אימות'}</button>
            </form>
        </main>
    );
}
