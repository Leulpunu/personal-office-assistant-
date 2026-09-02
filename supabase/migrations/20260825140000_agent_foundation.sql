-- Muna Office: multi-company, agent-ready foundation.
-- Apply with the Supabase CLI or paste into the Supabase SQL editor.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'am')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Africa/Addis_Ababa',
  default_language text not null default 'en'
    check (default_language in ('en', 'am')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee'
    check (role in ('owner', 'manager', 'employee')),
  job_title text,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  meeting_url text,
  organizer_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  openai_conversation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.agent_action_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.agent_conversations(id) on delete set null,
  tool_name text not null,
  status text not null
    check (status in ('proposed', 'approved', 'executed', 'rejected', 'failed')),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index organization_members_user_idx
  on public.organization_members(user_id);
create index tasks_org_status_due_idx
  on public.tasks(organization_id, status, due_at);
create index meetings_org_starts_idx
  on public.meetings(organization_id, starts_at);
create index documents_org_created_idx
  on public.documents(organization_id, created_at desc);
create index agent_conversations_user_idx
  on public.agent_conversations(organization_id, user_id, updated_at desc);
create index agent_messages_conversation_idx
  on public.agent_messages(conversation_id, created_at);
create index agent_action_log_user_idx
  on public.agent_action_log(organization_id, user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger agent_conversations_set_updated_at
before update on public.agent_conversations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.shares_organization(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other_user_id
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, text[]) from public;
revoke all on function public.shares_organization(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.shares_organization(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.documents enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_action_log enable row level security;

create policy profiles_select_colleagues
on public.profiles for select to authenticated
using (user_id = auth.uid() or public.shares_organization(user_id));

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy organizations_select_members
on public.organizations for select to authenticated
using (public.is_organization_member(id));

create policy organizations_insert_authenticated
on public.organizations for insert to authenticated
with check (created_by = auth.uid());

create policy organizations_update_owners
on public.organizations for update to authenticated
using (public.has_organization_role(id, array['owner']))
with check (public.has_organization_role(id, array['owner']));

create policy members_select_members
on public.organization_members for select to authenticated
using (public.is_organization_member(organization_id));

create policy members_insert_owner_or_creator
on public.organization_members for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner'])
  or (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.organizations
      where id = organization_id
        and created_by = auth.uid()
    )
  )
);

create policy members_update_owners
on public.organization_members for update to authenticated
using (public.has_organization_role(organization_id, array['owner']))
with check (public.has_organization_role(organization_id, array['owner']));

create policy members_delete_owners
on public.organization_members for delete to authenticated
using (
  public.has_organization_role(organization_id, array['owner'])
  and user_id <> auth.uid()
);

create policy tasks_select_members
on public.tasks for select to authenticated
using (public.is_organization_member(organization_id));

create policy tasks_insert_members
on public.tasks for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and created_by = auth.uid()
);

create policy tasks_update_members
on public.tasks for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy tasks_delete_managers
on public.tasks for delete to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']));

create policy meetings_select_members
on public.meetings for select to authenticated
using (public.is_organization_member(organization_id));

create policy meetings_insert_members
on public.meetings for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and organizer_id = auth.uid()
);

create policy meetings_update_organizer_or_managers
on public.meetings for update to authenticated
using (
  organizer_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'manager'])
)
with check (public.is_organization_member(organization_id));

create policy meetings_delete_organizer_or_managers
on public.meetings for delete to authenticated
using (
  organizer_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'manager'])
);

create policy documents_select_members
on public.documents for select to authenticated
using (public.is_organization_member(organization_id));

create policy documents_insert_members
on public.documents for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and uploaded_by = auth.uid()
);

create policy documents_update_uploader_or_managers
on public.documents for update to authenticated
using (
  uploaded_by = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'manager'])
)
with check (public.is_organization_member(organization_id));

create policy documents_delete_uploader_or_managers
on public.documents for delete to authenticated
using (
  uploaded_by = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'manager'])
);

create policy conversations_owner_access
on public.agent_conversations for all to authenticated
using (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
);

create policy messages_owner_access
on public.agent_messages for all to authenticated
using (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
);

create policy action_log_owner_access
on public.agent_action_log for all to authenticated
using (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_organization_member(organization_id)
);
