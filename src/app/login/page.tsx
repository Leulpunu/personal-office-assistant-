import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth-form';
import { getSupabasePublicConfig, isDemoModeEnabled } from '@/lib/supabase/config';
import { createUserSupabaseContext } from '@/lib/supabase/context';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const config = getSupabasePublicConfig();
  if (config) {
    const { data } = await createUserSupabaseContext();
    if (data) redirect('/onboarding');
  }

  const params = await searchParams;
  return (
    <AuthForm
      backendConfigured={Boolean(config)}
      demoAvailable={!config && isDemoModeEnabled()}
      confirmationFailed={params.error === 'confirmation_failed'}
    />
  );
}
