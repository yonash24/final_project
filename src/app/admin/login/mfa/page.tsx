import MfaForm from './MfaForm';

export default async function MfaLoginPage({ searchParams }: { searchParams: Promise<{ factor?: string; challenge?: string; returnTo?: string }> }) {
    const params = await searchParams;
    return <MfaForm factorId={params.factor ?? ''} challengeId={params.challenge ?? ''} returnTo={params.returnTo ?? '/admin'} />;
}
