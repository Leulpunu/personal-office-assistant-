import 'server-only';

import type { WorkspaceContext } from '@/lib/auth/workspace';
import {
  decryptEmailCredential,
  encryptEmailCredential,
} from '@/lib/email/credential-crypto';
import { getEmailProviderPreset } from '@/lib/email/providers';
import type { Json } from '@/types/database';
import type {
  CompanyEmailSettingsDTO,
  CompanyEmailSettingsInput,
} from '@/types/email-settings';

type EmailSettingsRow = {
  organization_id: string;
  provider: CompanyEmailSettingsInput['provider'];
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_require_tls: boolean;
  smtp_username: string;
  smtp_password_encrypted: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  last_tested_at: string | null;
  last_test_status: 'passed' | 'failed' | null;
  last_test_error: string | null;
  updated_at: string;
};

export type SmtpDeliveryConfiguration = {
  provider: CompanyEmailSettingsInput['provider'] | 'environment';
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
  from?: string;
  replyTo?: string;
};

export class CompanyEmailSettingsError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'EMAIL_SETTINGS_FAILED') {
    super(message);
    this.name = 'CompanyEmailSettingsError';
    this.status = status;
    this.code = code;
  }
}

const settingsColumns =
  'organization_id, provider, smtp_host, smtp_port, smtp_secure, smtp_require_tls, smtp_username, smtp_password_encrypted, from_name, from_email, reply_to, last_tested_at, last_test_status, last_test_error, updated_at';

function adminClient(workspace: WorkspaceContext) {
  if (workspace.mode !== 'supabase' || !workspace.supabaseAdmin) {
    throw new CompanyEmailSettingsError(
      'Company email settings require a configured Supabase workspace.',
      503,
      'EMAIL_SETTINGS_UNAVAILABLE',
    );
  }
  return workspace.supabaseAdmin;
}

function assertOwner(workspace: WorkspaceContext) {
  if (workspace.role !== 'owner') {
    throw new CompanyEmailSettingsError(
      'Only the company owner can change email-provider credentials.',
      403,
      'EMAIL_SETTINGS_FORBIDDEN',
    );
  }
}

function databaseFailure(error: { code?: string; message?: string } | null) {
  if (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.includes('organization_email_settings')
  ) {
    return new CompanyEmailSettingsError(
      'Install the company email settings database migration first.',
      503,
      'EMAIL_SETTINGS_MIGRATION_REQUIRED',
    );
  }
  return new CompanyEmailSettingsError(
    'Muna could not access the company email settings.',
  );
}

function toSettingsDTO(row: EmailSettingsRow): CompanyEmailSettingsDTO {
  return {
    configured: true,
    provider: row.provider,
    host: row.smtp_host,
    port: row.smtp_port,
    secure: row.smtp_secure,
    requireTls: row.smtp_require_tls,
    username: row.smtp_username,
    passwordConfigured: true,
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to || '',
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastTestError: row.last_test_error,
    updatedAt: row.updated_at,
  };
}

async function loadSettingsRow(workspace: WorkspaceContext) {
  const { data, error } = await adminClient(workspace)
    .from('organization_email_settings')
    .select(settingsColumns)
    .eq('organization_id', workspace.organizationId)
    .maybeSingle();
  if (error) throw databaseFailure(error);
  return data as EmailSettingsRow | null;
}

export async function getCompanyEmailSettings(
  workspace: WorkspaceContext,
): Promise<CompanyEmailSettingsDTO | null> {
  assertOwner(workspace);
  const row = await loadSettingsRow(workspace);
  return row ? toSettingsDTO(row) : null;
}

function canonicalSettings(input: CompanyEmailSettingsInput) {
  const preset = getEmailProviderPreset(input.provider);
  return {
    ...input,
    host: preset.endpointLocked ? preset.host : input.host.trim().toLowerCase(),
    port: preset.endpointLocked ? preset.port : input.port,
    secure: preset.endpointLocked ? preset.secure : input.secure,
    requireTls: preset.endpointLocked
      ? preset.requireTls
      : input.secure
        ? false
        : input.requireTls,
    username: input.username.trim(),
    fromName: input.fromName.trim(),
    fromEmail: input.fromEmail.trim().toLowerCase(),
    replyTo: input.replyTo.trim().toLowerCase(),
  };
}

async function auditSettingsChange(
  workspace: WorkspaceContext,
  toolName: string,
  input: Json,
) {
  await adminClient(workspace).from('agent_action_log').insert({
    organization_id: workspace.organizationId,
    user_id: workspace.userId,
    tool_name: toolName,
    status: 'executed',
    input,
    result: { success: true },
    executed_at: new Date().toISOString(),
  });
}

export async function saveCompanyEmailSettings(
  workspace: WorkspaceContext,
  input: CompanyEmailSettingsInput,
) {
  assertOwner(workspace);
  const current = await loadSettingsRow(workspace);
  const normalized = canonicalSettings(input);
  const encryptedPassword = input.password
    ? encryptEmailCredential(input.password, workspace.organizationId)
    : current?.smtp_password_encrypted;
  if (!encryptedPassword) {
    throw new CompanyEmailSettingsError(
      'Enter the mailbox or app password before saving.',
      400,
      'EMAIL_PASSWORD_REQUIRED',
    );
  }

  const { data, error } = await adminClient(workspace)
    .from('organization_email_settings')
    .upsert(
      {
        organization_id: workspace.organizationId,
        provider: normalized.provider,
        smtp_host: normalized.host,
        smtp_port: normalized.port,
        smtp_secure: normalized.secure,
        smtp_require_tls: normalized.requireTls,
        smtp_username: normalized.username,
        smtp_password_encrypted: encryptedPassword,
        from_name: normalized.fromName,
        from_email: normalized.fromEmail,
        reply_to: normalized.replyTo || null,
        last_tested_at: null,
        last_test_status: null,
        last_test_error: null,
        created_by: current ? undefined : workspace.userId,
        updated_by: workspace.userId,
      },
      { onConflict: 'organization_id' },
    )
    .select(settingsColumns)
    .single();
  if (error || !data) throw databaseFailure(error);

  await auditSettingsChange(workspace, 'configure_company_email', {
    provider: normalized.provider,
    host: normalized.host,
    port: normalized.port,
    from_email: normalized.fromEmail,
  });
  return toSettingsDTO(data as EmailSettingsRow);
}

export async function removeCompanyEmailSettings(workspace: WorkspaceContext) {
  assertOwner(workspace);
  const { error } = await adminClient(workspace)
    .from('organization_email_settings')
    .delete()
    .eq('organization_id', workspace.organizationId);
  if (error) throw databaseFailure(error);
  await auditSettingsChange(workspace, 'remove_company_email', {});
}

export async function loadCompanyEmailDeliveryConfiguration(
  workspace: WorkspaceContext,
): Promise<SmtpDeliveryConfiguration | null> {
  if (workspace.mode !== 'supabase') return null;
  const row = await loadSettingsRow(workspace);
  if (!row) return null;
  return {
    provider: row.provider,
    host: row.smtp_host,
    port: row.smtp_port,
    secure: row.smtp_secure,
    requireTls: row.smtp_require_tls,
    username: row.smtp_username,
    password: decryptEmailCredential(
      row.smtp_password_encrypted,
      workspace.organizationId,
    ),
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to || undefined,
  };
}

export async function recordCompanyEmailConnectionTest(
  workspace: WorkspaceContext,
  status: 'passed' | 'failed',
  message?: string,
) {
  const testedAt = new Date().toISOString();
  const { error } = await adminClient(workspace)
    .from('organization_email_settings')
    .update({
      last_tested_at: testedAt,
      last_test_status: status,
      last_test_error: status === 'failed' ? message?.slice(0, 500) || null : null,
      updated_by: workspace.userId,
    })
    .eq('organization_id', workspace.organizationId);
  if (error) throw databaseFailure(error);
  return testedAt;
}
