import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  runGuidedMunaAgent,
  runMunaAgent,
} from '@/lib/agent/muna-agent';
import { approveAndCreateTask } from '@/lib/data/tasks';
import {
  approveAndCancelMeeting,
  approveAndScheduleMeeting,
} from '@/lib/data/meetings';
import { approveAndSendEmail } from '@/lib/data/emails';
import { sendEmailProposalSchema } from '@/lib/email/validation';
import { consumeAgentRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2_000).nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueAt: z.string().datetime({ offset: true }).nullable(),
});

const taskProposalSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('create_task'),
  label: z.string().min(1).max(300),
  input: taskInputSchema,
});

const scheduleMeetingProposalSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('schedule_meeting'),
  label: z.string().min(1).max(300),
  input: z
    .object({
      title: z.string().trim().min(1).max(240),
      description: z.string().trim().max(2_000).nullable(),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      location: z.string().trim().max(240).nullable(),
      meetingUrl: z.string().url().max(2_000).nullable(),
      attendeeEmails: z.array(z.string().email()).max(100),
    })
    .refine((input) => new Date(input.endsAt) > new Date(input.startsAt), {
      message: 'The meeting must end after it starts.',
    }),
});

const cancelMeetingProposalSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('cancel_meeting'),
  label: z.string().min(1).max(300),
  input: z.object({
    meetingId: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(240),
    startsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(500).nullable(),
  }),
});

const proposalSchema = z.discriminatedUnion('type', [
  taskProposalSchema,
  scheduleMeetingProposalSchema,
  cancelMeetingProposalSchema,
  sendEmailProposalSchema,
]);

const requestSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000).optional(),
    language: z.enum(['en', 'am']).default('en'),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          text: z.string().trim().min(1).max(4_000),
        }),
      )
      .max(12)
      .default([]),
    approval: proposalSchema.optional(),
  })
  .refine((value) => Boolean(value.message || value.approval), {
    message: 'A message or an approved action is required.',
  });

function errorResponse(
  message: string,
  status: number,
  code: string,
  headers?: HeadersInit,
) {
  return Response.json(
    { error: { message, code } },
    { status, headers },
  );
}

function upstreamErrorDetails(error: unknown) {
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    type?: unknown;
  };

  return {
    message: error instanceof Error ? error.message : 'Unknown upstream error',
    status:
      typeof candidate.status === 'number' ? candidate.status : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    type: typeof candidate.type === 'string' ? candidate.type : undefined,
  };
}

function shouldUseGuidedFallback(details: ReturnType<typeof upstreamErrorDetails>) {
  return (
    details.status === 429 ||
    [
      'insufficient_quota',
      'credit_balance_exhausted',
      'organization_spend_limit_exceeded',
      'project_spend_limit_exceeded',
      'rate_limit_exceeded',
    ].includes(details.code || '')
  );
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse('Invalid JSON request.', 400, 'INVALID_JSON');
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message || 'Invalid agent request.',
      400,
      'INVALID_AGENT_REQUEST',
    );
  }

  const { data: workspace, error: workspaceError } =
    await getWorkspaceContext();
  if (workspaceError || !workspace) {
    return errorResponse(
      workspaceError.message,
      workspaceError.status ?? 401,
      workspaceError.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const rateLimit = consumeAgentRequest(workspace.userId);
  if (!rateLimit.allowed) {
    return errorResponse(
      'Too many agent requests. Please wait a moment.',
      429,
      'RATE_LIMITED',
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  try {
    if (parsed.data.approval) {
      const mode =
        process.env.OPENAI_API_KEY && workspace.mode === 'supabase'
          ? 'agent'
          : 'demo';
      const approval = parsed.data.approval;

      if (approval.type === 'create_task') {
        const task = await approveAndCreateTask(workspace, approval);
        return Response.json({
          mode,
          message:
            parsed.data.language === 'am'
              ? 'ሥራው ተፈጥሯል።'
              : 'The task has been created.',
          clientAction: {
            type: 'task_created',
            task: {
              id: task.id,
              title: task.title,
              priority: task.priority,
              dueAt: task.dueAt,
            },
          },
        });
      }

      if (approval.type === 'schedule_meeting') {
        const meeting = await approveAndScheduleMeeting(workspace, approval);
        return Response.json({
          mode,
          message:
            parsed.data.language === 'am'
              ? 'ስብሰባው ታቅዷል።'
              : 'The meeting has been scheduled.',
          clientAction: {
            type: 'meeting_created',
            meeting: {
              id: meeting.id,
              title: meeting.title,
              startsAt: meeting.startsAt,
              endsAt: meeting.endsAt,
              location: meeting.location,
              attendeeEmails: meeting.attendeeEmails,
            },
          },
        });
      }

      if (approval.type === 'send_email') {
        const email = await approveAndSendEmail(workspace, approval);
        return Response.json({
          mode,
          message:
            workspace.mode === 'demo'
              ? 'Demo delivery recorded. No external email was sent.'
              : parsed.data.language === 'am'
                ? 'ኢሜይሉ ተልኳል።'
                : 'The email has been sent.',
          clientAction: {
            type: 'email_sent',
            draftId: email.id,
            sentAt: email.sentAt!,
          },
        });
      }

      const meeting = await approveAndCancelMeeting(workspace, approval);
      return Response.json({
        mode,
        message:
          parsed.data.language === 'am'
            ? 'ስብሰባው ተሰርዟል።'
            : 'The meeting has been cancelled.',
        clientAction: {
          type: 'meeting_cancelled',
          meetingId: meeting.id,
        },
      });
    }

    const reply = await runMunaAgent({
      workspace,
      message: parsed.data.message!,
      language: parsed.data.language,
      history: parsed.data.history,
    });
    return Response.json(reply);
  } catch (error) {
    const details = upstreamErrorDetails(error);
    console.error('Muna agent request failed', details);

    if (parsed.data.message && shouldUseGuidedFallback(details)) {
      try {
        const fallback = await runGuidedMunaAgent({
          workspace,
          message: parsed.data.message,
          language: parsed.data.language,
          history: parsed.data.history,
        });
        return Response.json(fallback, {
          headers: { 'X-Muna-AI-Fallback': 'openai-quota' },
        });
      } catch (fallbackError) {
        console.error(
          'Muna guided fallback failed',
          upstreamErrorDetails(fallbackError),
        );
      }
    }

    return errorResponse(
      'Muna could not complete that request.',
      500,
      'AGENT_REQUEST_FAILED',
    );
  }
}
