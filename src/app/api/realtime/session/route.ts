import OpenAI from 'openai';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { consumeAgentRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  language: z.enum(['en', 'am']).default('en'),
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

function hasUsableApiKey(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  return !/(your|replace|placeholder|example|\.\.\.)/i.test(value);
}

function realtimeInstructions(language: 'en' | 'am') {
  const responseLanguage = language === 'am' ? 'Amharic' : 'English';
  return [
    'You are Muna, a trusted personal office assistant for an Ethiopian company.',
    'Speak with a warm, confident, professional feminine character.',
    'Use a natural Ethiopian conversational rhythm and keep spoken answers concise.',
    'Respond in ' + responseLanguage + '.',
    'For every user request, call use_office_agent exactly once before answering.',
    'The office agent enforces company access, grounding, and approval rules.',
    'After the tool returns, speak its message faithfully without inventing results.',
    'If the result contains a proposal, explain that the approval card is visible.',
    'Never claim a task, meeting, cancellation, or email send happened until the office agent says it was executed.',
  ].join(' ');
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
      parsed.error.issues[0]?.message || 'Invalid Realtime session request.',
      400,
      'INVALID_REALTIME_REQUEST',
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

  const rateLimit = consumeAgentRequest(
    'realtime-session:' + workspace.userId,
    5,
    60_000,
  );
  if (!rateLimit.allowed) {
    return errorResponse(
      'Too many voice sessions. Please wait a moment.',
      429,
      'RATE_LIMITED',
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasUsableApiKey(apiKey)) {
    return errorResponse(
      'Realtime voice is not configured. Muna will use the browser voice fallback.',
      503,
      'REALTIME_NOT_CONFIGURED',
    );
  }

  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2';
  const voice = process.env.OPENAI_REALTIME_VOICE || 'marin';
  const transcriptionModel =
    process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

  try {
    const client = new OpenAI({ apiKey });
    const secret = await client.realtime.clientSecrets.create({
      expires_after: {
        anchor: 'created_at',
        seconds: 60,
      },
      session: {
        type: 'realtime',
        model,
        instructions: realtimeInstructions(parsed.data.language),
        output_modalities: ['audio'],
        max_output_tokens: 700,
        parallel_tool_calls: false,
        tool_choice: 'required',
        tools: [
          {
            type: 'function',
            name: 'use_office_agent',
            description:
              'Send the user request to Muna office agent. It securely reads company data, drafts reversible work, and returns approval proposals for consequential actions.',
            parameters: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description:
                    'The complete office request expressed by the user.',
                },
              },
              required: ['message'],
              additionalProperties: false,
            },
          },
        ],
        audio: {
          input: {
            noise_reduction: { type: 'near_field' },
            transcription: {
              model: transcriptionModel,
              ...(parsed.data.language === 'en'
                ? { language: 'en' }
                : {
                    prompt:
                      'The speaker is using Amharic for an Ethiopian office conversation. Preserve Amharic words and names accurately.',
                  }),
            },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'auto',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice,
            speed: 0.98,
          },
        },
        tracing: null,
      },
    });

    return Response.json(
      {
        clientSecret: secret.value,
        expiresAt: secret.expires_at,
        model,
        voice,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error(
      'Muna Realtime session creation failed',
      error instanceof Error ? error.message : error,
    );
    return errorResponse(
      'Muna could not start a live voice session.',
      502,
      'REALTIME_SESSION_FAILED',
    );
  }
}
