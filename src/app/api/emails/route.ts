import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  createWorkspaceEmailDraft,
  deleteWorkspaceEmailDraft,
  listWorkspaceEmailDrafts,
  updateWorkspaceEmailDraft,
} from '@/lib/data/emails';
import { emailDraftInputSchema } from '@/lib/email/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  id: z.string().min(1).max(100),
  input: emailDraftInputSchema,
});

const deleteSchema = z.object({
  id: z.string().min(1).max(100),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

async function workspaceForRequest() {
  return getWorkspaceContext();
}

export async function GET() {
  const { data: workspace, error } = await workspaceForRequest();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  try {
    return Response.json({
      emails: await listWorkspaceEmailDrafts(workspace),
    });
  } catch {
    return errorResponse('Unable to load the email outbox.', 500, 'EMAIL_LIST_FAILED');
  }
}

export async function POST(request: Request) {
  const { data: workspace, error } = await workspaceForRequest();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = emailDraftInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message || 'Invalid email draft.',
      400,
      'INVALID_EMAIL_DRAFT',
    );
  }

  try {
    const email = await createWorkspaceEmailDraft(workspace, parsed.data);
    return Response.json({ email }, { status: 201 });
  } catch {
    return errorResponse('Unable to save the email draft.', 500, 'EMAIL_CREATE_FAILED');
  }
}

export async function PATCH(request: Request) {
  const { data: workspace, error } = await workspaceForRequest();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message || 'Invalid email draft update.',
      400,
      'INVALID_EMAIL_UPDATE',
    );
  }

  try {
    const email = await updateWorkspaceEmailDraft(
      workspace,
      parsed.data.id,
      parsed.data.input,
    );
    return Response.json({ email });
  } catch (caught) {
    return errorResponse(
      caught instanceof Error ? caught.message : 'Unable to update the email draft.',
      409,
      'EMAIL_UPDATE_FAILED',
    );
  }
}

export async function DELETE(request: Request) {
  const { data: workspace, error } = await workspaceForRequest();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('Invalid email deletion request.', 400, 'INVALID_EMAIL_DELETE');
  }

  try {
    await deleteWorkspaceEmailDraft(workspace, parsed.data.id);
    return Response.json({ deleted: true, id: parsed.data.id });
  } catch (caught) {
    return errorResponse(
      caught instanceof Error ? caught.message : 'Unable to delete the email draft.',
      409,
      'EMAIL_DELETE_FAILED',
    );
  }
}
