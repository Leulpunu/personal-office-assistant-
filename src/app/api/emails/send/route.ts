import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  approveAndSendEmail,
  proposeSendEmail,
} from '@/lib/data/emails';
import { sendEmailProposalSchema } from '@/lib/email/validation';
import { consumeAgentRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('propose'),
    draftId: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal('approve'),
    approval: sendEmailProposalSchema,
  }),
]);

function errorResponse(
  message: string,
  status: number,
  code: string,
  headers?: HeadersInit,
) {
  return Response.json({ error: { message, code } }, { status, headers });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message || 'Invalid email send request.',
      400,
      'INVALID_EMAIL_SEND',
    );
  }

  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const rateLimit = consumeAgentRequest(
    'email-send:' + workspace.userId,
    10,
    10 * 60_000,
  );
  if (!rateLimit.allowed) {
    return errorResponse(
      'Too many email send requests. Please wait before trying again.',
      429,
      'EMAIL_SEND_RATE_LIMITED',
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  try {
    if (parsed.data.action === 'propose') {
      const proposal = await proposeSendEmail(workspace, parsed.data.draftId);
      return Response.json({ proposal }, { status: 202 });
    }

    const email = await approveAndSendEmail(
      workspace,
      parsed.data.approval,
    );
    return Response.json({
      email,
      message:
        workspace.mode === 'demo'
          ? 'Demo delivery recorded. No external email was sent.'
          : 'The email was sent.',
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : 'Unable to send the email.';
    const isConfigurationError =
      message === 'Email delivery is not configured.' ||
      message.includes('SMTP_') ||
      message.includes('SMTP port');
    const isConflict =
      message.includes('changed') ||
      message.includes('already') ||
      message.includes('no longer') ||
      message.includes('expired');
    return errorResponse(
      message,
      isConfigurationError ? 503 : isConflict ? 409 : 502,
      isConfigurationError
        ? 'EMAIL_NOT_CONFIGURED'
        : isConflict
          ? 'EMAIL_SEND_CONFLICT'
          : 'EMAIL_DELIVERY_FAILED',
    );
  }
}
