import { redirect } from 'next/navigation';
import OnboardingForm from '@/components/onboarding-form';
import { getSupabasePublicConfig } from '@/lib/supabase/config';
import { createUserSupabaseContext } from '@/lib/supabase/context';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  if (!getSupabasePublicConfig()) redirect('/login');

  const { data: context, error } = await createUserSupabaseContext();
  if (error || !context) redirect('/login');

  const [{ data: membership }, { data: profile }] = await Promise.all([
    context.supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', context.userId)
      .limit(1)
      .maybeSingle(),
    context.supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', context.userId)
      .maybeSingle(),
  ]);

  if (membership) redirect('/');

  return (
    <OnboardingForm
      fullName={profile?.full_name || ''}
      email={context.userEmail}
    />
  );
}
