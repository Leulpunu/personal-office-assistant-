import 'server-only';

import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import {
  loadCompanyEmailDeliveryConfiguration,
  recordCompanyEmailConnectionTest,
  type SmtpDeliveryConfiguration,
} from '@/lib/email/company-settings';
import type { EmailDraftInput } from '@/types/emails';

export type EmailDeliveryResult = {
  messageId: string;
  simulated: boolean;
};

function environmentSmtpConfiguration(): SmtpDeliveryConfiguration | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT || '587');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('The SMTP port is invalid.');
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('Both SMTP_USER and SMTP_PASS are required when SMTP authentication is used.');
  }

  const secure =
    process.env.SMTP_SECURE === 'true' ||
    (process.env.SMTP_SECURE !== 'false' && port === 465);
  const requireTLS =
    !secure && process.env.SMTP_REQUIRE_TLS !== 'false';

  return {
    provider: 'environment',
    host,
    port,
    secure,
    requireTls: requireTLS,
    username: user,
    password: pass,
    from,
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
  };
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateAddress(normalized.slice(7));
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('2001:db8:')
    );
  }

  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

async function assertPublicSmtpHost(host: string) {
  const normalized = host.trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    isIP(normalized)
  ) {
    throw new Error('The SMTP server must use a public hostname.');
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new Error('The SMTP hostname could not be resolved.');
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('The SMTP hostname cannot point to a private network.');
  }
}

function smtpTransportOptions(
  configuration: SmtpDeliveryConfiguration,
): SMTPTransport.Options {
  return {
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    requireTLS: configuration.requireTls,
    auth:
      configuration.username && configuration.password
        ? {
            user: configuration.username,
            pass: configuration.password,
          }
        : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      servername: configuration.host,
    },
  };
}

function safeSmtpError(error: unknown) {
  const candidate = error as { code?: unknown; responseCode?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const responseCode =
    typeof candidate.responseCode === 'number' ? candidate.responseCode : 0;
  if (code === 'EAUTH' || [530, 534, 535].includes(responseCode)) {
    return new Error(
      'Email provider authentication failed. Check the username and app password.',
    );
  }
  if (['EDNS', 'ECONNECTION', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code)) {
    return new Error(
      'Muna could not connect to the SMTP server. Check its hostname, port, and firewall.',
    );
  }
  if (error instanceof Error && error.message.startsWith('The SMTP')) {
    return error;
  }
  if (
    error instanceof Error &&
    (error.message === 'Email delivery is not configured.' ||
      error.message === 'Save the company email settings before testing.' ||
      error.message.startsWith('EMAIL_CREDENTIALS_') ||
      error.message.startsWith('Muna could not decrypt') ||
      error.message.startsWith('Install the company email settings'))
  ) {
    return error;
  }
  return new Error(
    'The email provider rejected the connection. Review the provider settings and try again.',
  );
}

async function deliveryConfiguration(workspace: WorkspaceContext) {
  const companyConfiguration =
    await loadCompanyEmailDeliveryConfiguration(workspace);
  const configuration = companyConfiguration || environmentSmtpConfiguration();
  if (!configuration) throw new Error('Email delivery is not configured.');
  await assertPublicSmtpHost(configuration.host);
  return configuration;
}

export async function testCompanyEmailConnection(
  workspace: WorkspaceContext,
) {
  let canRecordResult = false;
  try {
    const configuration = await loadCompanyEmailDeliveryConfiguration(workspace);
    if (!configuration) {
      throw new Error('Save the company email settings before testing.');
    }
    canRecordResult = true;
    await assertPublicSmtpHost(configuration.host);
    const transporter = nodemailer.createTransport(
      smtpTransportOptions(configuration),
    );
    await transporter.verify();
    const testedAt = await recordCompanyEmailConnectionTest(
      workspace,
      'passed',
    );
    return { testedAt };
  } catch (caught) {
    const safeError = safeSmtpError(caught);
    if (canRecordResult) {
      await recordCompanyEmailConnectionTest(
        workspace,
        'failed',
        safeError.message,
      ).catch(() => undefined);
    }
    throw safeError;
  }
}

export async function deliverEmail(
  workspace: WorkspaceContext,
  email: EmailDraftInput,
): Promise<EmailDeliveryResult> {
  if (workspace.mode === 'demo') {
    return {
      messageId: 'demo-' + randomUUID(),
      simulated: true,
    };
  }

  try {
    const configuration = await deliveryConfiguration(workspace);
    const transporter = nodemailer.createTransport(
      smtpTransportOptions(configuration),
    );
    const result = await transporter.sendMail({
      from:
        configuration.from || {
          name: configuration.fromName!,
          address: configuration.fromEmail!,
        },
      replyTo: configuration.replyTo,
      to: email.toEmails,
      cc: email.ccEmails.length ? email.ccEmails : undefined,
      bcc: email.bccEmails.length ? email.bccEmails : undefined,
      subject: email.subject,
      text: email.bodyText,
    });

    if (!result.messageId) {
      throw new Error('The mail server did not return a delivery identifier.');
    }

    return {
      messageId: result.messageId,
      simulated: false,
    };
  } catch (caught) {
    throw safeSmtpError(caught);
  }
}
