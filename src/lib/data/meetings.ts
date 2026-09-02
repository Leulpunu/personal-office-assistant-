import 'server-only';

import { randomUUID } from 'node:crypto';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import type { Json } from '@/types/database';
import type {
  CancelMeetingInput,
  ProposedAgentAction,
  ScheduleMeetingInput,
} from '@/types/agent';
import type {
  MeetingRecordDTO,
  MeetingWriteInput,
} from '@/types/meetings';

type MeetingRange = {
  from: string;
  to: string;
  limit?: number;
};

function demoMeetings(): MeetingRecordDTO[] {
  const now = Date.now();
  return [
    {
      id: 'demo-meeting-1',
      title: 'Operations stand-up',
      description: 'Daily operations coordination.',
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 90 * 60 * 1000).toISOString(),
      location: 'Meeting room 2',
      meetingUrl: null,
      attendeeEmails: ['dawit@example.com', 'mekdes@example.com'],
      organizerId: 'demo-user',
      status: 'scheduled',
      cancellationReason: null,
    },
    {
      id: 'demo-meeting-2',
      title: 'Buna Export review',
      description: 'Review the next client shipment.',
      startsAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
      location: 'Google Meet',
      meetingUrl: 'https://meet.google.com/',
      attendeeEmails: ['sales@example.com'],
      organizerId: 'demo-user',
      status: 'scheduled',
      cancellationReason: null,
    },
    {
      id: 'demo-meeting-3',
      title: 'Finance check-in',
      description: null,
      startsAt: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 5.5 * 60 * 60 * 1000).toISOString(),
      location: "Selam's office",
      meetingUrl: null,
      attendeeEmails: ['finance@example.com'],
      organizerId: 'demo-user',
      status: 'scheduled',
      cancellationReason: null,
    },
  ];
}

function toMeetingDTO(meeting: {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  attendee_emails: string[];
  organizer_id: string;
  status: 'scheduled' | 'cancelled';
  cancellation_reason: string | null;
}): MeetingRecordDTO {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    location: meeting.location,
    meetingUrl: meeting.meeting_url,
    attendeeEmails: meeting.attendee_emails,
    organizerId: meeting.organizer_id,
    status: meeting.status,
    cancellationReason: meeting.cancellation_reason,
  };
}

const meetingColumns =
  'id, title, description, starts_at, ends_at, location, meeting_url, attendee_emails, organizer_id, status, cancellation_reason';

export async function listWorkspaceMeetings(
  workspace: WorkspaceContext,
  { from, to, limit = 30 }: MeetingRange,
): Promise<MeetingRecordDTO[]> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    return demoMeetings()
      .filter((meeting) => {
        const startsAt = new Date(meeting.startsAt).getTime();
        return meeting.status === 'scheduled' && startsAt >= fromTime && startsAt <= toTime;
      })
      .slice(0, limit);
  }

  const { data, error } = await workspace.supabase
    .from('meetings')
    .select(meetingColumns)
    .eq('organization_id', workspace.organizationId)
    .eq('status', 'scheduled')
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at', { ascending: true })
    .limit(Math.min(limit, 100));

  if (error) throw new Error('Unable to load company meetings.');
  return data.map(toMeetingDTO);
}

export async function getWorkspaceMeeting(
  workspace: WorkspaceContext,
  meetingId: string,
): Promise<MeetingRecordDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const meeting = demoMeetings().find((item) => item.id === meetingId);
    if (!meeting) throw new Error('Meeting not found.');
    return meeting;
  }

  const { data, error } = await workspace.supabase
    .from('meetings')
    .select(meetingColumns)
    .eq('id', meetingId)
    .eq('organization_id', workspace.organizationId)
    .single();

  if (error || !data) throw new Error('Meeting not found.');
  return toMeetingDTO(data);
}

export async function createWorkspaceMeeting(
  workspace: WorkspaceContext,
  input: MeetingWriteInput,
): Promise<MeetingRecordDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return {
      id: randomUUID(),
      ...input,
      organizerId: workspace.userId,
      status: 'scheduled',
      cancellationReason: null,
    };
  }

  const { data, error } = await workspace.supabase
    .from('meetings')
    .insert({
      organization_id: workspace.organizationId,
      title: input.title,
      description: input.description,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
      meeting_url: input.meetingUrl,
      attendee_emails: input.attendeeEmails,
      organizer_id: workspace.userId,
    })
    .select(meetingColumns)
    .single();

  if (error || !data) throw new Error('Unable to create the meeting.');
  return toMeetingDTO(data);
}

export async function updateWorkspaceMeeting(
  workspace: WorkspaceContext,
  meetingId: string,
  input: MeetingWriteInput,
): Promise<MeetingRecordDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const meeting = await getWorkspaceMeeting(workspace, meetingId);
    return { ...meeting, ...input };
  }

  const { data, error } = await workspace.supabase
    .from('meetings')
    .update({
      title: input.title,
      description: input.description,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
      meeting_url: input.meetingUrl,
      attendee_emails: input.attendeeEmails,
    })
    .eq('id', meetingId)
    .eq('organization_id', workspace.organizationId)
    .eq('status', 'scheduled')
    .select(meetingColumns)
    .single();

  if (error || !data) throw new Error('Unable to update the meeting.');
  return toMeetingDTO(data);
}

export async function cancelWorkspaceMeeting(
  workspace: WorkspaceContext,
  meetingId: string,
  reason: string | null,
): Promise<MeetingRecordDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const meeting = await getWorkspaceMeeting(workspace, meetingId);
    return { ...meeting, status: 'cancelled', cancellationReason: reason };
  }

  const { data, error } = await workspace.supabase
    .from('meetings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: workspace.userId,
      cancellation_reason: reason,
    })
    .eq('id', meetingId)
    .eq('organization_id', workspace.organizationId)
    .eq('status', 'scheduled')
    .select(meetingColumns)
    .single();

  if (error || !data) throw new Error('Unable to cancel the meeting.');
  return toMeetingDTO(data);
}

async function recordProposal(
  workspace: WorkspaceContext,
  id: string,
  toolName: 'schedule_meeting' | 'cancel_meeting',
  input: ScheduleMeetingInput | CancelMeetingInput,
) {
  if (workspace.mode !== 'supabase' || !workspace.supabase) return;

  const { data, error } = await workspace.supabase
    .from('agent_action_log')
    .insert({
      id,
      organization_id: workspace.organizationId,
      user_id: workspace.userId,
      tool_name: toolName,
      status: 'proposed',
      input: input as unknown as Json,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error('Unable to record the meeting proposal.');
}

export async function proposeScheduleMeeting(
  workspace: WorkspaceContext,
  input: ScheduleMeetingInput,
): Promise<ProposedAgentAction> {
  const id = randomUUID();
  await recordProposal(workspace, id, 'schedule_meeting', input);
  return {
    id,
    type: 'schedule_meeting',
    label: 'Schedule meeting: ' + input.title,
    input,
  };
}

export async function proposeCancelMeeting(
  workspace: WorkspaceContext,
  meetingId: string,
  reason: string | null,
): Promise<ProposedAgentAction> {
  const meeting = await getWorkspaceMeeting(workspace, meetingId);
  if (meeting.status !== 'scheduled') throw new Error('Meeting is already cancelled.');
  if (workspace.role === 'employee' && meeting.organizerId !== workspace.userId) {
    throw new Error('Only the organizer or a manager can cancel this meeting.');
  }

  const input: CancelMeetingInput = {
    meetingId: meeting.id,
    title: meeting.title,
    startsAt: meeting.startsAt,
    reason,
  };
  const id = randomUUID();
  await recordProposal(workspace, id, 'cancel_meeting', input);
  return {
    id,
    type: 'cancel_meeting',
    label: 'Cancel meeting: ' + meeting.title,
    input,
  };
}

async function loadAndApproveAction(
  workspace: WorkspaceContext,
  proposal: ProposedAgentAction,
  toolName: 'schedule_meeting' | 'cancel_meeting',
) {
  if (!workspace.supabase) throw new Error('Company backend is unavailable.');

  const { data: action, error } = await workspace.supabase
    .from('agent_action_log')
    .select('id, status, tool_name, input, created_at')
    .eq('id', proposal.id)
    .eq('organization_id', workspace.organizationId)
    .eq('user_id', workspace.userId)
    .single();

  if (
    error ||
    !action ||
    action.status !== 'proposed' ||
    action.tool_name !== toolName ||
    Date.now() - new Date(action.created_at).getTime() > 30 * 60 * 1000
  ) {
    throw new Error('This meeting action is missing, expired, or already used.');
  }

  if (JSON.stringify(action.input) !== JSON.stringify(proposal.input)) {
    throw new Error('The approved meeting action does not match its proposal.');
  }

  const { data: approved, error: approvalError } = await workspace.supabase
    .from('agent_action_log')
    .update({ status: 'approved' })
    .eq('id', action.id)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();

  if (approvalError || !approved) {
    throw new Error('This meeting action was already approved or is no longer available.');
  }

  return action.input;
}

async function finishAction(
  workspace: WorkspaceContext,
  actionId: string,
  result: Json,
) {
  if (!workspace.supabase) return;
  await workspace.supabase
    .from('agent_action_log')
    .update({
      status: 'executed',
      result,
      executed_at: new Date().toISOString(),
    })
    .eq('id', actionId);
}

export async function approveAndScheduleMeeting(
  workspace: WorkspaceContext,
  proposal: Extract<ProposedAgentAction, { type: 'schedule_meeting' }>,
): Promise<MeetingRecordDTO> {
  const storedInput =
    workspace.mode === 'demo'
      ? proposal.input
      : ((await loadAndApproveAction(
          workspace,
          proposal,
          'schedule_meeting',
        )) as unknown as ScheduleMeetingInput);

  try {
    const meeting = await createWorkspaceMeeting(workspace, storedInput);
    await finishAction(workspace, proposal.id, { meeting_id: meeting.id });
    return meeting;
  } catch (error) {
    if (workspace.supabase) {
      await workspace.supabase
        .from('agent_action_log')
        .update({
          status: 'failed',
          result: { error: 'Meeting creation failed.' },
          executed_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);
    }
    throw error;
  }
}

export async function approveAndCancelMeeting(
  workspace: WorkspaceContext,
  proposal: Extract<ProposedAgentAction, { type: 'cancel_meeting' }>,
): Promise<MeetingRecordDTO> {
  const storedInput =
    workspace.mode === 'demo'
      ? proposal.input
      : ((await loadAndApproveAction(
          workspace,
          proposal,
          'cancel_meeting',
        )) as unknown as CancelMeetingInput);

  try {
    const meeting = await cancelWorkspaceMeeting(
      workspace,
      storedInput.meetingId,
      storedInput.reason,
    );
    await finishAction(workspace, proposal.id, { meeting_id: meeting.id });
    return meeting;
  } catch (error) {
    if (workspace.supabase) {
      await workspace.supabase
        .from('agent_action_log')
        .update({
          status: 'failed',
          result: { error: 'Meeting cancellation failed.' },
          executed_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);
    }
    throw error;
  }
}
