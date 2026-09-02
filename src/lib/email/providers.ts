import type { EmailProvider } from '@/types/email-settings';

export type EmailProviderPreset = {
  id: EmailProvider;
  label: string;
  description: string;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  endpointLocked: boolean;
  passwordLabel: string;
};

export const EMAIL_PROVIDER_PRESETS: EmailProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    description: 'Use the mailbox address and a Google app password.',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTls: true,
    endpointLocked: true,
    passwordLabel: 'Google app password',
  },
  {
    id: 'microsoft365',
    label: 'Microsoft 365 / Outlook',
    description: 'Connect a Microsoft mailbox with authenticated SMTP enabled.',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    requireTls: true,
    endpointLocked: true,
    passwordLabel: 'Mailbox password or app password',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    description: 'Use the full Zoho mailbox address and an app password.',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    requireTls: true,
    endpointLocked: true,
    passwordLabel: 'Zoho app password',
  },
  {
    id: 'cpanel',
    label: 'cPanel / company email',
    description: 'Use the outgoing mail server supplied by the hosting company.',
    host: '',
    port: 465,
    secure: true,
    requireTls: false,
    endpointLocked: false,
    passwordLabel: 'Mailbox password',
  },
  {
    id: 'custom',
    label: 'Custom SMTP',
    description: 'Connect any public standards-compatible SMTP server.',
    host: '',
    port: 587,
    secure: false,
    requireTls: true,
    endpointLocked: false,
    passwordLabel: 'SMTP password',
  },
];

export function getEmailProviderPreset(provider: EmailProvider) {
  return EMAIL_PROVIDER_PRESETS.find((preset) => preset.id === provider)!;
}
