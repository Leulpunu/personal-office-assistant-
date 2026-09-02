import 'server-only';

import { z } from 'zod';
import type {
  FunctionTool,
  ResponseFunctionToolCall,
} from 'openai/resources/responses/responses';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import {
  listOpenTasks,
  proposeCreateTask,
} from '@/lib/data/tasks';
import {
  listWorkspaceMeetings,
  proposeCancelMeeting,
  proposeScheduleMeeting,
} from '@/lib/data/meetings';
import {
  getWorkspaceDocumentText,
  listWorkspaceDocuments,
  searchWorkspaceDocuments,
} from '@/lib/data/documents';
import {
  createWorkspaceEmailDraft,
  listWorkspaceEmailDrafts,
  proposeSendEmail,
} from '@/lib/data/emails';
import { emailDraftInputSchema } from '@/lib/email/validation';
import type { ProposedAgentAction } from '@/types/agent';

const listTasksSchema = z.object({
  limit: z.number().int().min(1).max(20),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2_000).nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_at: z.string().datetime({ offset: true }).nullable(),
});

const listMeetingsSchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  limit: z.number().int().min(1).max(20),
}).refine((value) => new Date(value.to) >= new Date(value.from), {
  message: 'The meeting range must end after it starts.',
});

const scheduleMeetingSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2_000).nullable(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  location: z.string().trim().max(240).nullable(),
  meeting_url: z.string().url().max(2_000).nullable(),
  attendee_emails: z.array(z.string().email()).max(100),
}).refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
  message: 'A meeting must end after it starts.',
});

const cancelMeetingSchema = z.object({
  meeting_id: z.string().min(1).max(100),
  reason: z.string().trim().max(500).nullable(),
});

const listDocumentsSchema = z.object({
  limit: z.number().int().min(1).max(20),
});

const searchDocumentsSchema = z.object({
  query: z.string().trim().min(1).max(300),
  limit: z.number().int().min(1).max(10),
});

const summarizeDocumentSchema = z.object({
  document_id: z.string().min(1).max(100),
  max_characters: z.number().int().min(1_000).max(50_000),
});

const listEmailDraftsSchema = z.object({
  limit: z.number().int().min(1).max(20),
});

const draftEmailSchema = z.object({
  to_emails: z.array(z.string().email()).min(1).max(20),
  cc_emails: z.array(z.string().email()).max(20),
  bcc_emails: z.array(z.string().email()).max(20),
  subject: z.string().trim().min(1).max(240),
  body_text: z.string().trim().min(1).max(20_000),
});

const prepareEmailSendSchema = z.object({
  draft_id: z.string().min(1).max(100),
});

export const officeTools: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_tasks',
    description:
      'List open tasks for the signed-in user current company workspace.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of tasks to return.',
        },
      },
      required: ['limit'],
    },
  },
  {
    type: 'function',
    name: 'create_task',
    description:
      'Prepare a company task. The user must approve the proposal before the task is written.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description: 'Short action-oriented task title.',
        },
        description: {
          type: ['string', 'null'],
          description: 'Optional task details.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
        due_at: {
          type: ['string', 'null'],
          description: 'ISO 8601 due date with timezone, or null.',
        },
      },
      required: ['title', 'description', 'priority', 'due_at'],
    },
  },
  {
    type: 'function',
    name: 'list_meetings',
    description:
      'List scheduled meetings in the signed-in user current company workspace for an exact date range.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: {
          type: 'string',
          description: 'ISO 8601 range start with timezone.',
        },
        to: {
          type: 'string',
          description: 'ISO 8601 range end with timezone.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of meetings to return.',
        },
      },
      required: ['from', 'to', 'limit'],
    },
  },
  {
    type: 'function',
    name: 'schedule_meeting',
    description:
      'Prepare a meeting in the company calendar. The user must approve the proposal before it is scheduled.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', description: 'Short meeting title.' },
        description: {
          type: ['string', 'null'],
          description: 'Optional agenda or notes.',
        },
        starts_at: {
          type: 'string',
          description: 'ISO 8601 start date and time with timezone.',
        },
        ends_at: {
          type: 'string',
          description: 'ISO 8601 end date and time with timezone.',
        },
        location: {
          type: ['string', 'null'],
          description: 'Optional room, office, or venue.',
        },
        meeting_url: {
          type: ['string', 'null'],
          description: 'Optional absolute online meeting URL.',
        },
        attendee_emails: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 100,
          description: 'Attendee email addresses, or an empty array.',
        },
      },
      required: [
        'title',
        'description',
        'starts_at',
        'ends_at',
        'location',
        'meeting_url',
        'attendee_emails',
      ],
    },
  },
  {
    type: 'function',
    name: 'cancel_meeting',
    description:
      'Prepare cancellation of an existing company meeting. The user must approve before cancellation.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        meeting_id: {
          type: 'string',
          description: 'Exact meeting id returned by list_meetings.',
        },
        reason: {
          type: ['string', 'null'],
          description: 'Optional cancellation reason.',
        },
      },
      required: ['meeting_id', 'reason'],
    },
  },
  {
    type: 'function',
    name: 'list_email_drafts',
    description:
      'List the signed-in user private email outbox. Use this to identify an exact draft before preparing a send.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of email drafts to return.',
        },
      },
      required: ['limit'],
    },
  },
  {
    type: 'function',
    name: 'draft_email',
    description:
      'Save a private plain-text email draft. This never sends email and does not require send approval.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        to_emails: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 20,
          description: 'Primary recipient email addresses.',
        },
        cc_emails: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 20,
          description: 'CC recipient email addresses, or an empty array.',
        },
        bcc_emails: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 20,
          description: 'BCC recipient email addresses, or an empty array.',
        },
        subject: {
          type: 'string',
          description: 'Professional email subject without line breaks.',
        },
        body_text: {
          type: 'string',
          description: 'Complete professional plain-text email body.',
        },
      },
      required: [
        'to_emails',
        'cc_emails',
        'bcc_emails',
        'subject',
        'body_text',
      ],
    },
  },
  {
    type: 'function',
    name: 'prepare_email_send',
    description:
      'Prepare delivery of one exact saved email draft. This does not send; the user must separately review and approve the proposal.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        draft_id: {
          type: 'string',
          description: 'Exact draft id returned by list_email_drafts or draft_email.',
        },
      },
      required: ['draft_id'],
    },
  },
  {
    type: 'function',
    name: 'list_documents',
    description:
      'List documents visible in the signed-in user current company workspace. Returns metadata only.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of documents to return.',
        },
      },
      required: ['limit'],
    },
  },
  {
    type: 'function',
    name: 'search_documents',
    description:
      'Search the extracted text and names of documents in the current company workspace. Use this before answering questions based on company files.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'Concise keywords describing the information to find.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Maximum number of matching documents to return.',
        },
      },
      required: ['query', 'limit'],
    },
  },
  {
    type: 'function',
    name: 'summarize_document',
    description:
      'Read searchable text from one exact company document so you can summarize it. Use an id returned by list_documents or search_documents and do not guess ids.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        document_id: {
          type: 'string',
          description: 'Exact document id returned by a document read tool.',
        },
        max_characters: {
          type: 'integer',
          minimum: 1000,
          maximum: 50000,
          description: 'Maximum extracted characters to read.',
        },
      },
      required: ['document_id', 'max_characters'],
    },
  },
];

function parseArguments(call: ResponseFunctionToolCall) {
  try {
    return JSON.parse(call.arguments) as unknown;
  } catch {
    throw new Error('The agent produced invalid tool arguments.');
  }
}

export async function executeOfficeTool(
  workspace: WorkspaceContext,
  call: ResponseFunctionToolCall,
): Promise<{ output: string; proposal?: ProposedAgentAction }> {
  const rawArguments = parseArguments(call);

  if (call.name === 'list_tasks') {
    const { limit } = listTasksSchema.parse(rawArguments);
    const tasks = await listOpenTasks(workspace, limit);
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        tasks,
      }),
    };
  }

  if (call.name === 'create_task') {
    const input = createTaskSchema.parse(rawArguments);
    const proposal = await proposeCreateTask(workspace, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.due_at,
    });

    return {
      proposal,
      output: JSON.stringify({
        status: 'confirmation_required',
        action_id: proposal.id,
        message:
          'The task is prepared but has not been created. Ask the user to approve it.',
        task: proposal.input,
      }),
    };
  }

  if (call.name === 'list_meetings') {
    const { from, to, limit } = listMeetingsSchema.parse(rawArguments);
    const meetings = await listWorkspaceMeetings(workspace, { from, to, limit });
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        timezone: workspace.timezone,
        meetings,
      }),
    };
  }

  if (call.name === 'schedule_meeting') {
    const input = scheduleMeetingSchema.parse(rawArguments);
    const proposal = await proposeScheduleMeeting(workspace, {
      title: input.title,
      description: input.description,
      startsAt: input.starts_at,
      endsAt: input.ends_at,
      location: input.location,
      meetingUrl: input.meeting_url,
      attendeeEmails: input.attendee_emails,
    });
    return {
      proposal,
      output: JSON.stringify({
        status: 'confirmation_required',
        action_id: proposal.id,
        message:
          'The meeting is prepared but has not been scheduled. Ask the user to approve it.',
        meeting: proposal.input,
      }),
    };
  }

  if (call.name === 'cancel_meeting') {
    const input = cancelMeetingSchema.parse(rawArguments);
    const proposal = await proposeCancelMeeting(
      workspace,
      input.meeting_id,
      input.reason,
    );
    return {
      proposal,
      output: JSON.stringify({
        status: 'confirmation_required',
        action_id: proposal.id,
        message:
          'The cancellation is prepared but has not happened. Ask the user to approve it.',
        meeting: proposal.input,
      }),
    };
  }

  if (call.name === 'list_email_drafts') {
    const { limit } = listEmailDraftsSchema.parse(rawArguments);
    const emails = await listWorkspaceEmailDrafts(workspace, limit);
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        emails: emails.map((email) => ({
          id: email.id,
          to_emails: email.toEmails,
          cc_emails: email.ccEmails,
          subject: email.subject,
          status: email.status,
          updated_at: email.updatedAt,
        })),
      }),
    };
  }

  if (call.name === 'draft_email') {
    const rawInput = draftEmailSchema.parse(rawArguments);
    const input = emailDraftInputSchema.parse({
      toEmails: rawInput.to_emails,
      ccEmails: rawInput.cc_emails,
      bccEmails: rawInput.bcc_emails,
      subject: rawInput.subject,
      bodyText: rawInput.body_text,
    });
    const email = await createWorkspaceEmailDraft(workspace, input);
    return {
      output: JSON.stringify({
        status: 'draft_saved',
        message:
          'The private email draft was saved. No email was sent. Tell the user that sending requires a separate approval.',
        email: {
          id: email.id,
          to_emails: email.toEmails,
          cc_emails: email.ccEmails,
          subject: email.subject,
          status: email.status,
        },
      }),
    };
  }

  if (call.name === 'prepare_email_send') {
    const { draft_id } = prepareEmailSendSchema.parse(rawArguments);
    const proposal = await proposeSendEmail(workspace, draft_id);
    return {
      proposal,
      output: JSON.stringify({
        status: 'confirmation_required',
        action_id: proposal.id,
        message:
          'The email is prepared but has not been sent. Ask the user to review the recipients, subject, and preview, then approve it.',
        email: proposal.input,
      }),
    };
  }

  if (call.name === 'list_documents') {
    const { limit } = listDocumentsSchema.parse(rawArguments);
    const documents = await listWorkspaceDocuments(workspace, limit);
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        documents,
      }),
    };
  }

  if (call.name === 'search_documents') {
    const { query, limit } = searchDocumentsSchema.parse(rawArguments);
    const documents = await searchWorkspaceDocuments(workspace, query, limit);
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        query,
        documents,
      }),
    };
  }

  if (call.name === 'summarize_document') {
    const { document_id, max_characters } =
      summarizeDocumentSchema.parse(rawArguments);
    const result = await getWorkspaceDocumentText(
      workspace,
      document_id,
      max_characters,
    );
    return {
      output: JSON.stringify({
        organization: workspace.organizationName,
        ...result,
      }),
    };
  }

  throw new Error('The requested office tool is not available.');
}
