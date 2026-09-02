import { redirect } from 'next/navigation';
import OfficeDashboard from '@/components/office-dashboard';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { listWorkspaceMeetings } from '@/lib/data/meetings';
import { listWorkspaceTasks } from '@/lib/data/tasks';
import { listWorkspaceDocuments } from '@/lib/data/documents';
import { listWorkspaceEmailDrafts } from '@/lib/data/emails';

export const dynamic = 'force-dynamic';

function initialsFor(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'ME';
}

export default async function Home() {
  const { data: workspace, error } = await getWorkspaceContext();

  if (!workspace || error) {
    if (error.code === 'WORKSPACE_REQUIRED') redirect('/onboarding');
    if ((error.status ?? 401) === 401) redirect('/login');
    throw error;
  }

  const initialNow = new Date();

  const [tasks, meetings, documents, emails] =
    workspace.mode === 'supabase'
      ? await Promise.all([
          listWorkspaceTasks(workspace),
          listWorkspaceMeetings(workspace, {
            from: initialNow.toISOString(),
            to: new Date(
              initialNow.getTime() + 31 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
          listWorkspaceDocuments(workspace),
          listWorkspaceEmailDrafts(workspace),
        ])
      : [undefined, undefined, undefined, undefined];

  return (
    <OfficeDashboard
      initialNow={initialNow.toISOString()}
      workspace={{
        mode: workspace.mode,
        name: workspace.organizationName,
        role: workspace.role,
        userId: workspace.userId,
        userName: workspace.userName,
        userInitials: initialsFor(workspace.userName),
        timezone: workspace.timezone,
      }}
      initialTaskRecords={tasks}
      initialMeetingRecords={meetings}
      initialDocumentRecords={documents}
      initialEmailRecords={emails}
    />
  );
}
