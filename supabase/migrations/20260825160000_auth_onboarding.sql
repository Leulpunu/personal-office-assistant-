-- Muna Office: authenticated company onboarding and single-use invitations.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  role text not null default 'employee'
    check (role in ('manager', 'employee')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

create index organization_invitations_org_idx
  on public.organization_invitations(organization_id, created_at desc);
create index organization_invitations_email_idx
  on public.organization_invitations(email, expires_at);

alter table public.organization_invitations enable row level security;

create policy invitations_select_managers
on public.organization_invitations for select to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']
  )
);

create policy invitations_delete_managers
on public.organization_invitations for delete to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']
  )
);

create or replace function public.create_organization_with_owner(
  organization_name text,
  organization_slug text,
  organization_language text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_organization_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  if exists (
    select 1
    from public.organization_members
    where user_id = caller_id
  ) then
    raise exception 'Your account already belongs to a company.';
  end if;

  if organization_language not in ('en', 'am') then
    raise exception 'Unsupported company language.';
  end if;

  insert into public.organizations (
    name,
    slug,
    default_language,
    created_by
  )
  values (
    pg_catalog.btrim(organization_name),
    pg_catalog.lower(pg_catalog.btrim(organization_slug)),
    organization_language,
    caller_id
  )
  returning id into new_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (new_organization_id, caller_id, 'owner');

  return new_organization_id;
end;
$$;

create or replace function public.create_organization_invitation(
  target_organization_id uuid,
  invite_email text,
  invite_role text default 'employee',
  valid_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(invite_email));
  raw_token text;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select role into caller_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = caller_id;

  if caller_role not in ('owner', 'manager') then
    raise exception 'Only company owners and managers can invite members.'
      using errcode = '42501';
  end if;

  if invite_role not in ('manager', 'employee') then
    raise exception 'Unsupported invitation role.';
  end if;

  if invite_role = 'manager' and caller_role <> 'owner' then
    raise exception 'Only a company owner can invite a manager.'
      using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid invitation email is required.';
  end if;

  if valid_days < 1 or valid_days > 30 then
    raise exception 'Invitation validity must be between 1 and 30 days.';
  end if;

  raw_token := pg_catalog.encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    created_by,
    expires_at
  )
  values (
    target_organization_id,
    normalized_email,
    invite_role,
    pg_catalog.encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    caller_id,
    now() + pg_catalog.make_interval(days => valid_days)
  );

  return raw_token;
end;
$$;

create or replace function public.accept_organization_invitation(
  invitation_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := pg_catalog.lower(
    coalesce(auth.jwt() ->> 'email', '')
  );
  invitation public.organization_invitations%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  select * into invitation
  from public.organization_invitations
  where token_hash = pg_catalog.encode(
    extensions.digest(pg_catalog.btrim(invitation_token), 'sha256'),
    'hex'
  )
  for update;

  if invitation.id is null
    or invitation.accepted_at is not null
    or invitation.expires_at <= now() then
    raise exception 'This invitation is invalid, expired, or already used.';
  end if;

  if caller_email = '' or caller_email <> invitation.email then
    raise exception 'Sign in with the email address that received this invitation.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id = caller_id
  ) then
    raise exception 'Your account already belongs to a company.';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    invitation.organization_id,
    caller_id,
    invitation.role
  );

  update public.organization_invitations
  set accepted_by = caller_id,
      accepted_at = now()
  where id = invitation.id;

  return invitation.organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, text) from public;
revoke all on function public.create_organization_invitation(uuid, text, text, integer) from public;
revoke all on function public.accept_organization_invitation(text) from public;

grant execute on function public.create_organization_with_owner(text, text, text) to authenticated;
grant execute on function public.create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
