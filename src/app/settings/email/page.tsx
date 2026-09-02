import { redirect } from 'next/navigation';
import EmailProviderSettings from '@/components/email-provider-settings';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    if (error.code === 'WORKSPACE_REQUIRED') redirect('/onboarding');
    if ((error.status ?? 401) === 401) redirect('/login');
    throw error;
  }

  return (
    <EmailProviderSettings
      companyName={workspace.organizationName}
      canManage={workspace.mode === 'supabase' && workspace.role === 'owner'}
    />
  );
}
