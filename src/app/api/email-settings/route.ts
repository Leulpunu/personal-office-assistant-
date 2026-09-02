import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  CompanyEmailSettingsError,
  getCompanyEmailSettings,
  removeCompanyEmailSettings,
  saveCompanyEmailSettings,
} from '@/lib/email/company-settings';
import { companyEmailSettingsInputSchema } from '@/lib/email/settings-validation';
import { testCompanyEmailConnection } from '@/lib/email/smtp';
import { consumeAgentRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(message: string, status: number, code: string) {
  return Response.json(
    { error: { message, code } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function settingsResponse(settings: unknown, status = 200) {
  return Response.json(
    { settings },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function mappedError(caught: unknown) {
  if (caught instanceof CompanyEmailSettingsError) {
    return errorResponse(caught.message, caught.status, caught.code);
  }
  return errorResponse(
    caught instanceof Error
      ? caught.message
      : 'Muna could not manage the company email connection.',
    500,
    'EMAIL_SETTINGS_FAILED',
  );
}

async function ownerWorkspace() {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return {
      workspace: null,
      response: errorResponse(
        error.message,
        error.status ?? 401,
        error.code ?? 'WORKSPACE_ACCESS_DENIED',
      ),
    };
  }
  if (workspace.mode !== 'supabase') {
    return {
      workspace: null,
      response: errorResponse(
        'Company email settings are unavailable in demo mode.',
        400,
        'EMAIL_SETTINGS_DEMO_MODE',
      ),
    };
  }
  if (workspace.role !== 'owner') {
    return {
      workspace: null,
      response: errorResponse(
        'Only the company owner can manage email-provider credentials.',
        403,
        'EMAIL_SETTINGS_FORBIDDEN',
      ),
    };
  }
  return { workspace, response: null };
}

function writeRateLimit(userId: string) {
  const result = consumeAgentRequest(
    'email-settings:' + userId,
    12,
    10 * 60_000,
  );
  if (result.allowed) return null;
  return errorResponse(
    'Too many email settings requests. Please wait before trying again.',
    429,
    'EMAIL_SETTINGS_RATE_LIMITED',
  );
}

export async function GET() {
  const { workspace, response } = await ownerWorkspace();
  if (!workspace) return response!;
  try {
    return settingsResponse(await getCompanyEmailSettings(workspace));
  } catch (caught) {
    return mappedError(caught);
  }
}

export async function PUT(request: Request) {
  const { workspace, response } = await ownerWorkspace();
  if (!workspace) return response!;
  const limited = writeRateLimit(workspace.userId);
  if (limited) return limited;

  const parsed = companyEmailSettingsInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message || 'Invalid email-provider settings.',
      400,
      'INVALID_EMAIL_SETTINGS',
    );
  }

  try {
    return settingsResponse(
      await saveCompanyEmailSettings(workspace, parsed.data),
    );
  } catch (caught) {
    return mappedError(caught);
  }
}

export async function POST() {
  const { workspace, response } = await ownerWorkspace();
  if (!workspace) return response!;
  const limited = writeRateLimit(workspace.userId);
  if (limited) return limited;

  try {
    const result = await testCompanyEmailConnection(workspace);
    return Response.json(
      {
        connected: true,
        testedAt: result.testedAt,
        message: 'Muna connected to the email provider successfully.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (caught) {
    if (caught instanceof CompanyEmailSettingsError) {
      return mappedError(caught);
    }
    return errorResponse(
      caught instanceof Error
        ? caught.message
        : 'Muna could not connect to the email provider.',
      422,
      'EMAIL_CONNECTION_TEST_FAILED',
    );
  }
}

export async function DELETE() {
  const { workspace, response } = await ownerWorkspace();
  if (!workspace) return response!;
  const limited = writeRateLimit(workspace.userId);
  if (limited) return limited;

  try {
    await removeCompanyEmailSettings(workspace);
    return settingsResponse(null);
  } catch (caught) {
    return mappedError(caught);
  }
}
