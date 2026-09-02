-- Muna Office: private personal outbox with audited, human-approved delivery.

create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  bcc_emails text[] not null default '{}'::text[],
  subject text not null
    check (
      char_length(subject) between 1 and 240
      and subject !~ E'[\\r\\n]'
    ),
  body_text text not null check (char_length(body_text) between 1 and 20000),
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(to_emails) between 1 and 20),
  check (cardinality(cc_emails) <= 20),
  check (cardinality(bcc_emails) <= 20),
  check (
    cardinality(to_emails) +
    cardinality(cc_emails) +
    cardinality(bcc_emails) <= 50
  ),
  check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index email_drafts_owner_status_idx
  on public.email_drafts(organization_id, created_by, status, updated_at desc);

create trigger email_drafts_set_updated_at
before update on public.email_drafts
for each row execute function public.set_updated_at();

alter table public.email_drafts enable row level security;

create policy email_drafts_select_owner
on public.email_drafts for select to authenticated
using (
  created_by = auth.uid()
  and public.is_organization_member(organization_id)
);

create policy email_drafts_insert_owner
on public.email_drafts for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_organization_member(organization_id)
  and status = 'draft'
  and sent_at is null
  and provider_message_id is null
);

create policy email_drafts_update_owner
on public.email_drafts for update to authenticated
using (
  created_by = auth.uid()
  and public.is_organization_member(organization_id)
)
with check (
  created_by = auth.uid()
  and public.is_organization_member(organization_id)
);

create policy email_drafts_delete_owner
on public.email_drafts for delete to authenticated
using (
  created_by = auth.uid()
  and public.is_organization_member(organization_id)
  and status in ('draft', 'failed')
);
