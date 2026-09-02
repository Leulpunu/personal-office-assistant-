import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import { deliverEmail } from '@/lib/email/smtp';
import { sendEmailInputSchema } from '@/lib/email/validation';
import type {
  ProposedAgentAction,
  SendEmailInput,
} from '@/types/agent';
import type { Json } from '@/types/database';
import type {
  EmailDraftDTO,
  EmailDraftInput,
} from '@/types/emails';

type EmailDraftRow = {
  id: string;
  created_by: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_text: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type DemoEmailGlobal = typeof globalThis & {
  __munaEmailDrafts?: Map<string, EmailDraftDTO>;
};

const globalEmailStore = globalThis as DemoEmailGlobal;
if (!globalEmailStore.__munaEmailDrafts) {
  const createdAt = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  const sample: EmailDraftDTO = {
    id: '6b45a340-50cf-45d8-8f26-5fc1eebd9f2c',
    createdBy: 'demo-user',
    toEmails: ['supplier@example.com'],
    ccEmails: [],
    bccEmails: [],
    subject: 'Updated delivery schedule',
    bodyText:
      'Hello,\n\nCould you please confirm the updated delivery schedule for our next shipment?\n\nBest regards,\nSelam',
    status: 'draft',
    sentAt: null,
    lastError: null,
    createdAt,
    updatedAt: createdAt,
  };
  globalEmailStore.__munaEmailDrafts = new Map([[sample.id, sample]]);
}

const demoEmailDrafts = globalEmailStore.__munaEmailDrafts;
const emailColumns =
  'id, created_by, to_emails, cc_emails, bcc_emails, subject, body_text, status, sent_at, last_error, created_at, updated_at';

function toEmailDraftDTO(row: EmailDraftRow): EmailDraftDTO {
  return {
    id: row.id,
    createdBy: row.created_by,
    toEmails: row.to_emails,
    ccEmails: row.cc_emails,
    bccEmails: row.bcc_emails,
    subject: row.subject,
    bodyText: row.body_text,
    status: row.status,
    sentAt: row.sent_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftContent(draft: EmailDraftInput) {
  return {
    toEmails: draft.toEmails,
    ccEmails: draft.ccEmails,
    bccEmails: draft.bccEmails,
    subject: draft.subject,
    bodyText: draft.bodyText,
  };
}

export function emailContentHash(draft: EmailDraftInput) {
  return createHash('sha256')
    .update(JSON.stringify(draftContent(draft)))
    .digest('hex');
}

export async function listWorkspaceEmailDrafts(
  workspace: WorkspaceContext,
  limit = 100,
): Promise<EmailDraftDTO[]> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return [...demoEmailDrafts.values()]
      .filter((draft) => draft.createdBy === workspace.userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .select(emailColumns)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (error) throw new Error('Unable to load the email outbox.');
  return data.map((row) => toEmailDraftDTO(row as EmailDraftRow));
}

export async function getWorkspaceEmailDraft(
  workspace: WorkspaceContext,
  draftId: string,
): Promise<EmailDraftDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const draft = demoEmailDrafts.get(draftId);
    if (!draft || draft.createdBy !== workspace.userId) {
      throw new Error('Email draft not found.');
    }
    return draft;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .select(emailColumns)
    .eq('id', draftId)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .single();

  if (error || !data) throw new Error('Email draft not found.');
  return toEmailDraftDTO(data as EmailDraftRow);
}

export async function createWorkspaceEmailDraft(
  workspace: WorkspaceContext,
  input: EmailDraftInput,
): Promise<EmailDraftDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const now = new Date().toISOString();
    const draft: EmailDraftDTO = {
      id: randomUUID(),
      createdBy: workspace.userId,
      ...input,
      status: 'draft',
      sentAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    demoEmailDrafts.set(draft.id, draft);
    return draft;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .insert({
      organization_id: workspace.organizationId,
      created_by: workspace.userId,
      to_emails: input.toEmails,
      cc_emails: input.ccEmails,
      bcc_emails: input.bccEmails,
      subject: input.subject,
      body_text: input.bodyText,
    })
    .select(emailColumns)
    .single();

  if (error || !data) throw new Error('Unable to save the email draft.');
  return toEmailDraftDTO(data as EmailDraftRow);
}

export async function updateWorkspaceEmailDraft(
  workspace: WorkspaceContext,
  draftId: string,
  input: EmailDraftInput,
): Promise<EmailDraftDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const current = await getWorkspaceEmailDraft(workspace, draftId);
    if (!['draft', 'failed'].includes(current.status)) {
      throw new Error('Only unsent email drafts can be edited.');
    }
    const draft: EmailDraftDTO = {
      ...current,
      ...input,
      status: 'draft',
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    demoEmailDrafts.set(draft.id, draft);
    return draft;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .update({
      to_emails: input.toEmails,
      cc_emails: input.ccEmails,
      bcc_emails: input.bccEmails,
      subject: input.subject,
      body_text: input.bodyText,
      status: 'draft',
      last_error: null,
    })
    .eq('id', draftId)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .in('status', ['draft', 'failed'])
    .select(emailColumns)
    .maybeSingle();

  if (error || !data) throw new Error('Only unsent email drafts can be edited.');
  return toEmailDraftDTO(data as EmailDraftRow);
}

export async function deleteWorkspaceEmailDraft(
  workspace: WorkspaceContext,
  draftId: string,
) {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const draft = await getWorkspaceEmailDraft(workspace, draftId);
    if (!['draft', 'failed'].includes(draft.status)) {
      throw new Error('Only unsent email drafts can be deleted.');
    }
    demoEmailDrafts.delete(draftId);
    return;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .delete()
    .eq('id', draftId)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .in('status', ['draft', 'failed'])
    .select('id')
    .maybeSingle();

  if (error || !data) throw new Error('Only unsent email drafts can be deleted.');
}

function sendInputFor(draft: EmailDraftDTO): SendEmailInput {
  return {
    draftId: draft.id,
    toEmails: draft.toEmails,
    ccEmails: draft.ccEmails,
    bccEmails: draft.bccEmails,
    subject: draft.subject,
    bodyPreview: draft.bodyText.replace(/\s+/g, ' ').slice(0, 320),
    contentHash: emailContentHash(draft),
  };
}

export async function proposeSendEmail(
  workspace: WorkspaceContext,
  draftId: string,
): Promise<Extract<ProposedAgentAction, { type: 'send_email' }>> {
  const draft = await getWorkspaceEmailDraft(workspace, draftId);
  if (!['draft', 'failed'].includes(draft.status)) {
    throw new Error('Only an unsent email draft can be prepared for sending.');
  }

  const id = randomUUID();
  const input = sendInputFor(draft);
  if (workspace.mode === 'supabase' && workspace.supabase) {
    const { data, error } = await workspace.supabase
      .from('agent_action_log')
      .insert({
        id,
        organization_id: workspace.organizationId,
        user_id: workspace.userId,
        tool_name: 'send_email',
        status: 'proposed',
        input: input as unknown as Json,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error('Unable to record the email send proposal.');
  }

  return {
    id,
    type: 'send_email',
    label: 'Send email: ' + draft.subject,
    input,
  };
}

async function failAction(
  workspace: WorkspaceContext,
  actionId: string,
  message: string,
) {
  if (!workspace.supabase) return;
  await workspace.supabase
    .from('agent_action_log')
    .update({
      status: 'failed',
      result: { error: message },
      executed_at: new Date().toISOString(),
    })
    .eq('id', actionId);
}

async function loadAndApproveSendAction(
  workspace: WorkspaceContext,
  proposal: Extract<ProposedAgentAction, { type: 'send_email' }>,
): Promise<SendEmailInput> {
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
    action.tool_name !== 'send_email' ||
    Date.now() - new Date(action.created_at).getTime() > 30 * 60 * 1000
  ) {
    throw new Error('This email send approval is missing, expired, or already used.');
  }

  const storedInput = sendEmailInputSchema.parse(action.input);
  if (JSON.stringify(storedInput) !== JSON.stringify(proposal.input)) {
    throw new Error('The approved email does not match its recorded proposal.');
  }

  const { data: approved, error: approvalError } = await workspace.supabase
    .from('agent_action_log')
    .update({ status: 'approved' })
    .eq('id', action.id)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();
  if (approvalError || !approved) {
    throw new Error('This email send approval was already used.');
  }

  return storedInput;
}

async function setDraftSending(
  workspace: WorkspaceContext,
  draftId: string,
): Promise<EmailDraftDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const draft = await getWorkspaceEmailDraft(workspace, draftId);
    if (!['draft', 'failed'].includes(draft.status)) {
      throw new Error('This email draft is no longer available to send.');
    }
    const sending = {
      ...draft,
      status: 'sending' as const,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    demoEmailDrafts.set(draft.id, sending);
    return sending;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .update({ status: 'sending', last_error: null })
    .eq('id', draftId)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .in('status', ['draft', 'failed'])
    .select(emailColumns)
    .maybeSingle();
  if (error || !data) throw new Error('This email draft is no longer available to send.');
  return toEmailDraftDTO(data as EmailDraftRow);
}

async function setDraftDeliveryFailed(
  workspace: WorkspaceContext,
  draft: EmailDraftDTO,
) {
  const message = 'Delivery failed. Check the mail server configuration and try again.';
  if (workspace.mode === 'demo' || !workspace.supabase) {
    demoEmailDrafts.set(draft.id, {
      ...draft,
      status: 'failed',
      lastError: message,
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  await workspace.supabase
    .from('email_drafts')
    .update({ status: 'failed', last_error: message })
    .eq('id', draft.id)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .eq('status', 'sending');
}

export async function approveAndSendEmail(
  workspace: WorkspaceContext,
  proposal: Extract<ProposedAgentAction, { type: 'send_email' }>,
): Promise<EmailDraftDTO> {
  const storedInput =
    workspace.mode === 'demo'
      ? proposal.input
      : await loadAndApproveSendAction(workspace, proposal);

  const current = await getWorkspaceEmailDraft(workspace, storedInput.draftId);
  if (
    emailContentHash(current) !== storedInput.contentHash ||
    JSON.stringify(sendInputFor(current)) !== JSON.stringify(storedInput)
  ) {
    await failAction(workspace, proposal.id, 'The draft changed after approval was requested.');
    throw new Error('The email draft changed. Review it and approve sending again.');
  }

  let sending: EmailDraftDTO;
  try {
    sending = await setDraftSending(workspace, current.id);
  } catch (error) {
    await failAction(workspace, proposal.id, 'The draft was no longer sendable.');
    throw error;
  }

  let delivery;
  try {
    delivery = await deliverEmail(workspace, sending);
  } catch (error) {
    await setDraftDeliveryFailed(workspace, sending);
    await failAction(workspace, proposal.id, 'Email delivery failed.');
    throw error;
  }

  const sentAt = new Date().toISOString();
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const sent: EmailDraftDTO = {
      ...sending,
      status: 'sent',
      sentAt,
      lastError: null,
      updatedAt: sentAt,
    };
    demoEmailDrafts.set(sent.id, sent);
    return sent;
  }

  const { data, error } = await workspace.supabase
    .from('email_drafts')
    .update({
      status: 'sent',
      sent_at: sentAt,
      provider_message_id: delivery.messageId,
      last_error: null,
    })
    .eq('id', sending.id)
    .eq('organization_id', workspace.organizationId)
    .eq('created_by', workspace.userId)
    .eq('status', 'sending')
    .select(emailColumns)
    .maybeSingle();

  await workspace.supabase
    .from('agent_action_log')
    .update({
      status: 'executed',
      result: {
        draft_id: sending.id,
        provider_message_id: delivery.messageId,
      },
      executed_at: sentAt,
    })
    .eq('id', proposal.id);

  if (error || !data) {
    throw new Error('The email was delivered, but its outbox status needs reconciliation.');
  }
  return toEmailDraftDTO(data as EmailDraftRow);
}
