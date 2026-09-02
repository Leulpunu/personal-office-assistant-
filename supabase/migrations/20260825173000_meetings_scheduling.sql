-- Muna Office: meeting lifecycle, attendees, and cancellation metadata.

alter table public.meetings
  add column status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  add column attendee_emails text[] not null default '{}'::text[],
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users(id) on delete set null,
  add column cancellation_reason text,
  add constraint meetings_attendee_limit
    check (cardinality(attendee_emails) <= 100),
  add constraint meetings_cancellation_state
    check (
      (status = 'scheduled' and cancelled_at is null and cancelled_by is null)
      or (status = 'cancelled' and cancelled_at is not null)
    );

create index meetings_org_status_starts_idx
  on public.meetings(organization_id, status, starts_at);
