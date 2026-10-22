create extension if not exists vector;

create table public.smart_brains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default '我的 Smart Brain',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.smart_brains to authenticated;
grant all on public.smart_brains to service_role;
alter table public.smart_brains enable row level security;
create policy "own brains" on public.smart_brains for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.brain_documents (
  id uuid primary key default gen_random_uuid(),
  brain_id uuid not null references public.smart_brains(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  chars integer not null default 0,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, delete on public.brain_documents to authenticated;
grant all on public.brain_documents to service_role;
alter table public.brain_documents enable row level security;
create policy "own docs read" on public.brain_documents for select to authenticated using (auth.uid() = user_id);
create policy "own docs delete" on public.brain_documents for delete to authenticated using (auth.uid() = user_id);

create table public.brain_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.brain_documents(id) on delete cascade,
  brain_id uuid not null references public.smart_brains(id) on delete cascade,
  user_id uuid not null,
  idx integer not null,
  content text not null,
  embedding vector(3072) not null
);
grant all on public.brain_chunks to service_role;
alter table public.brain_chunks enable row level security;
create index brain_chunks_user_idx on public.brain_chunks(user_id);
create index brain_chunks_embedding_idx on public.brain_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_brain_chunks(p_user uuid, query_embedding vector(3072), match_count int default 6)
returns table (id uuid, content text, title text, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.content, d.title, 1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from brain_chunks c join brain_documents d on d.id = c.document_id join smart_brains b on b.id = c.brain_id
  where c.user_id = p_user and b.enabled
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
revoke execute on function public.match_brain_chunks(uuid, vector, int) from public, anon, authenticated;
grant execute on function public.match_brain_chunks(uuid, vector, int) to service_role;