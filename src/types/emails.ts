export type EmailDraftStatus = 'draft' | 'sending' | 'sent' | 'failed';

export type EmailDraftInput = {
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  bodyText: string;
};

export type EmailDraftDTO = EmailDraftInput & {
  id: string;
  createdBy: string;
  status: EmailDraftStatus;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};
