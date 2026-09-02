export type EmailProvider =
  | 'gmail'
  | 'microsoft365'
  | 'zoho'
  | 'cpanel'
  | 'custom';

export type EmailTestStatus = 'passed' | 'failed' | null;

export type CompanyEmailSettingsInput = {
  provider: EmailProvider;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

export type CompanyEmailSettingsDTO = Omit<
  CompanyEmailSettingsInput,
  'password'
> & {
  configured: true;
  passwordConfigured: true;
  lastTestedAt: string | null;
  lastTestStatus: EmailTestStatus;
  lastTestError: string | null;
  updatedAt: string;
};
