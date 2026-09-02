-- Muna Office: private company document storage and tenant-scoped text search.

alter table public.documents
  add column status text not null default 'ready'
    check (status in ('processing', 'ready', 'failed')),
  add column content_text text not null default '',
  add column extraction_error text,
  add column search_vector tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(content_text, '')
    )
  ) stored;

create index documents_search_idx
  on public.documents using gin(search_vector);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-documents',
  'company-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_organization_member_path(
  target_organization_id text
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
    where organization_id::text = target_organization_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_path_role(
  target_organization_id text,
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
    where organization_id::text = target_organization_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.is_organization_member_path(text) from public;
revoke all on function public.has_organization_path_role(text, text[]) from public;
grant execute on function public.is_organization_member_path(text) to authenticated;
grant execute on function public.has_organization_path_role(text, text[]) to authenticated;

create policy company_documents_select_members
on storage.objects for select to authenticated
using (
  bucket_id = 'company-documents'
  and public.is_organization_member_path((storage.foldername(name))[1])
);

create policy company_documents_insert_members
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-documents'
  and public.is_organization_member_path((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy company_documents_delete_uploader_or_managers
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-documents'
  and public.is_organization_member_path((storage.foldername(name))[1])
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.has_organization_path_role(
      (storage.foldername(name))[1],
      array['owner', 'manager']
    )
  )
);

create or replace function public.search_company_documents(
  target_organization_id uuid,
  search_query text,
  result_limit integer default 5
)
returns table (
  id uuid,
  name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz,
  status text,
  excerpt text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parsed_query as (
    select plainto_tsquery('simple'::regconfig, trim(search_query)) as value
  )
  select
    document.id,
    document.name,
    document.mime_type,
    document.size_bytes,
    document.uploaded_by,
    document.created_at,
    document.status,
    left(
      regexp_replace(document.content_text, '[[:space:]]+', ' ', 'g'),
      1200
    ) as excerpt,
    ts_rank(document.search_vector, parsed_query.value) as rank
  from public.documents as document
  cross join parsed_query
  where document.organization_id = target_organization_id
    and public.is_organization_member(target_organization_id)
    and document.status = 'ready'
    and (
      document.search_vector @@ parsed_query.value
      or document.name ilike '%' || trim(search_query) || '%'
    )
  order by rank desc, document.updated_at desc
  limit least(greatest(result_limit, 1), 20);
$$;

revoke all on function public.search_company_documents(uuid, text, integer)
  from public;
grant execute on function public.search_company_documents(uuid, text, integer)
  to authenticated;
