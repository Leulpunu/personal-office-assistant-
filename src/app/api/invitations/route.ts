import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const invitationSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['manager', 'employee']),
});

export async function POST(request: Request) {
  const { data: workspace, error: workspaceError } =
    await getWorkspaceContext();
  if (!workspace || workspaceError) {
    return Response.json(
      { error: { message: 'Authentication is required.' } },
      { status: workspaceError.status ?? 401 },
    );
  }

  if (workspace.mode !== 'supabase' || !workspace.supabase) {
    return Response.json(
      { error: { message: 'Invitations require a connected company backend.' } },
      { status: 400 },
    );
  }

  const parsed = invitationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: { message: 'Enter a valid email and role.' } },
      { status: 400 },
    );
  }

  if (
    !['owner', 'manager'].includes(workspace.role) ||
    (parsed.data.role === 'manager' && workspace.role !== 'owner')
  ) {
    return Response.json(
      { error: { message: 'You cannot assign that company role.' } },
      { status: 403 },
    );
  }

  const { data: code, error } = await workspace.supabase.rpc(
    'create_organization_invitation',
    {
      target_organization_id: workspace.organizationId,
      invite_email: parsed.data.email,
      invite_role: parsed.data.role,
      valid_days: 7,
    },
  );

  if (error || !code) {
    return Response.json(
      { error: { message: 'The invitation could not be created.' } },
      { status: 500 },
    );
  }

  return Response.json({ code, email: parsed.data.email, role: parsed.data.role });
}
