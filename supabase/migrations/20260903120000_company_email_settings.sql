-- Muna Office: encrypted, server-managed email delivery settings per company.

create table public.organization_email_settings (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  provider text not null
    check (provider in ('gmail', 'microsoft365', 'zoho', 'cpanel', 'custom')),
  smtp_host text not null
    check (char_length(smtp_host) between 3 and 253),
  smtp_port integer not null
    check (smtp_port between 1 and 65535),
  smtp_secure boolean not null default false,
  smtp_require_tls boolean not null default true,
  smtp_username text not null
    check (char_length(smtp_username) between 1 and 320),
  smtp_password_encrypted text not null
    check (char_length(smtp_password_encrypted) between 40 and 4096),
  from_name text not null
    check (char_length(from_name) between 1 and 120),
  from_email text not null
    check (
      char_length(from_email) between 3 and 254
      and from_email = lower(from_email)
      and from_email !~ E'[\\r\\n]'
    ),
  reply_to text
    check (
      reply_to is null
      or (
        char_length(reply_to) between 3 and 254
        and reply_to = lower(reply_to)
        and reply_to !~ E'[\\r\\n]'
      )
    ),
  last_tested_at timestamptz,
  last_test_status text
    check (last_test_status is null or last_test_status in ('passed', 'failed')),
  last_test_error text
    check (last_test_error is null or char_length(last_test_error) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_email_settings_set_updated_at
before update on public.organization_email_settings
for each row execute function public.set_updated_at();

alter table public.organization_email_settings enable row level security;

-- Credentials are decrypted only by Muna's authenticated server routes using
-- the Supabase secret client. Never expose this table through the browser API.
revoke all on table public.organization_email_settings from anon, authenticated;

comment on table public.organization_email_settings is
  'Server-only encrypted SMTP configuration for each Muna company workspace.';
comment on column public.organization_email_settings.smtp_password_encrypted is
  'AES-256-GCM ciphertext. The encryption key stays outside Supabase.';
