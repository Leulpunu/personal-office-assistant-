import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  cancelWorkspaceMeeting,
  createWorkspaceMeeting,
  listWorkspaceMeetings,
  updateWorkspaceMeeting,
} from '@/lib/data/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailSchema = z.string().trim().email().max(320);
const meetingFields = {
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2_000).nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  location: z.string().trim().max(300).nullable(),
  meetingUrl: z.string().trim().url().max(2_000).nullable(),
  attendeeEmails: z.array(emailSchema).max(100),
};

const writeMeetingSchema = z
  .object(meetingFields)
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: 'Meeting end time must be after its start time.',
  });
const updateMeetingSchema = writeMeetingSchema.and(
  z.object({ id: z.string().uuid() }),
);
const cancelMeetingSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().default(null),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

async function requireWorkspace() {
  return getWorkspaceContext();
}

export async function GET(request: Request) {
  const { data: workspace, error } = await requireWorkspace();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date().toISOString();
  const to =
    url.searchParams.get('to') ||
    new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
  if (!z.string().datetime({ offset: true }).safeParse(from).success ||
      !z.string().datetime({ offset: true }).safeParse(to).success) {
    return errorResponse('Invalid meeting date range.', 400, 'INVALID_MEETING_RANGE');
  }

  try {
    const meetings = await listWorkspaceMeetings(workspace, { from, to });
    return Response.json({ meetings });
  } catch {
    return errorResponse('Unable to load meetings.', 500, 'MEETING_LIST_FAILED');
  }
}

export async function POST(request: Request) {
  const { data: workspace, error } = await requireWorkspace();
  if (!workspace || error) {
    return errorResponse(error.message, error.status ?? 401, error.code ?? 'WORKSPACE_ACCESS_DENIED');
  }

  const parsed = writeMeetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid meeting.', 400, 'INVALID_MEETING');
  }

  try {
    const meeting = await createWorkspaceMeeting(workspace, parsed.data);
    return Response.json({ meeting }, { status: 201 });
  } catch {
    return errorResponse('Unable to create meeting.', 500, 'MEETING_CREATE_FAILED');
  }
}

export async function PATCH(request: Request) {
  const { data: workspace, error } = await requireWorkspace();
  if (!workspace || error) {
    return errorResponse(error.message, error.status ?? 401, error.code ?? 'WORKSPACE_ACCESS_DENIED');
  }

  const parsed = updateMeetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid meeting update.', 400, 'INVALID_MEETING_UPDATE');
  }

  const { id, ...input } = parsed.data;
  try {
    const meeting = await updateWorkspaceMeeting(workspace, id, input);
    return Response.json({ meeting });
  } catch {
    return errorResponse('Unable to update meeting.', 403, 'MEETING_UPDATE_FAILED');
  }
}

export async function DELETE(request: Request) {
  const { data: workspace, error } = await requireWorkspace();
  if (!workspace || error) {
    return errorResponse(error.message, error.status ?? 401, error.code ?? 'WORKSPACE_ACCESS_DENIED');
  }

  const parsed = cancelMeetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('Invalid cancellation request.', 400, 'INVALID_MEETING_CANCELLATION');
  }

  try {
    const meeting = await cancelWorkspaceMeeting(
      workspace,
      parsed.data.id,
      parsed.data.reason,
    );
    return Response.json({ meeting });
  } catch {
    return errorResponse('Unable to cancel meeting.', 403, 'MEETING_CANCEL_FAILED');
  }
}
