create table public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  source text not null default 'manual',
  calendar_event text not null default '',
  started_at timestamptz,
  transcript text not null default '',
  summary jsonb not null default '{}'::jsonb,
  brain_document_id uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.meeting_records to authenticated;
grant all on public.meeting_records to service_role;
alter table public.meeting_records enable row level security;
create policy "own meetings" on public.meeting_records for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index meeting_records_user_idx on public.meeting_records (user_id, created_at desc);