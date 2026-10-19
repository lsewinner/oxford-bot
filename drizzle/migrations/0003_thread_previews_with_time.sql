drop function if exists public.thread_previews(uuid[]);

create or replace function public.thread_previews(p_thread_ids uuid[])
returns table (thread_id uuid, preview text, role text, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (m.thread_id)
    m.thread_id,
    coalesce(
      nullif((select p->>'text' from jsonb_array_elements(m.parts) p where p->>'type' = 'text' limit 1), ''),
      '[图片/文件]'
    ) as preview,
    m.role,
    m.created_at as updated_at
  from public.messages m
  where m.thread_id = any (p_thread_ids)
  order by m.thread_id, m.created_at desc
$$;

grant execute on function public.thread_previews(uuid[]) to authenticated;
grant execute on function public.thread_previews(uuid[]) to service_role;