import { redirect } from 'next/navigation';

import AdminNavbar from '@/components/admin/AdminNavbar';
import { OPERATION_PERMISSION } from '@/lib/admin/activity-changes';
import { hasPermission, requireAdmin } from '@/lib/admin/auth';
import { createSSRClient, supabaseServer } from '@/lib/supabase/server';
import ApprovalClient from './ApprovalClient';

export default async function ActivityChangeApprovalPage({ params }: { params: Promise<{ id: string }> }) {
    const profile = await requireAdmin();
    const { id } = await params;
    const { data: change } = await supabaseServer.from('activity_change_requests')
        .select('id,operation,before_snapshot,proposed_changes,status,approval_method,expires_at')
        .eq('id', id).eq('actor_email', profile.email).maybeSingle();
    if (!change || change.approval_method !== 'web_mfa') redirect('/admin/classes');
    const permission = OPERATION_PERMISSION[change.operation as keyof typeof OPERATION_PERMISSION];
    if (!permission || !hasPermission(profile, permission)) redirect('/admin/classes');

    const supabase = await createSSRClient();
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.find((item) => item.status === 'verified');
        if (!factor) redirect(`/admin/settings?mfaRequired=1&returnTo=${encodeURIComponent(`/admin/activity-changes/${id}`)}`);
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (!challenge) redirect('/admin/settings?mfaRequired=1');
        redirect(`/admin/login/mfa?factor=${encodeURIComponent(factor.id)}&challenge=${encodeURIComponent(challenge.id)}&returnTo=${encodeURIComponent(`/admin/activity-changes/${id}`)}`);
    }

    return <div className="admin-root"><AdminNavbar /><main className="admin-container" id="main-content">
        <ApprovalClient change={change as Parameters<typeof ApprovalClient>[0]['change']} />
    </main></div>;
}
