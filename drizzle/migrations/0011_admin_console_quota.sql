create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.account_controls (
  user_id uuid primary key,
  daily_limit integer check (daily_limit is null or daily_limit >= 0),
  banned boolean not null default false,
  pro_granted boolean not null default false,
  pro_until timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.account_controls to authenticated;
grant all on public.account_controls to service_role;
alter table public.account_controls enable row level security;
create policy "own controls read" on public.account_controls for select to authenticated using (auth.uid() = user_id);
create policy "admins read controls" on public.account_controls for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.usage_daily (
  user_id uuid not null,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);
grant select on public.usage_daily to authenticated;
grant all on public.usage_daily to service_role;
alter table public.usage_daily enable row level security;
create policy "own usage read" on public.usage_daily for select to authenticated using (auth.uid() = user_id);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy "admins read audit" on public.admin_audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid and environment = check_env
    and ((status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now()))
  ) or exists (
    select 1 from public.account_controls
    where user_id = user_uuid and pro_granted and (pro_until is null or pro_until > now())
  );
$$;

-- Atomically consumes one message from the caller's daily quota.
create or replace function public.consume_daily_message(check_env text, free_limit integer, pro_limit integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); ctl public.account_controls; lim integer; used integer; today date := (now() at time zone 'utc')::date;
begin
  if uid is null then return jsonb_build_object('allowed', false, 'reason', 'auth'); end if;
  select * into ctl from public.account_controls where user_id = uid;
  if ctl.banned then return jsonb_build_object('allowed', false, 'reason', 'banned'); end if;
  lim := coalesce(ctl.daily_limit, case when public.has_active_subscription(uid, check_env) then pro_limit else free_limit end);
  insert into public.usage_daily(user_id, day, count) values (uid, today, 0) on conflict do nothing;
  update public.usage_daily set count = count + 1 where user_id = uid and day = today and count < lim returning count into used;
  if used is null then
    select count into used from public.usage_daily where user_id = uid and day = today;
    return jsonb_build_object('allowed', false, 'reason', 'quota', 'used', used, 'limit', lim);
  end if;
  return jsonb_build_object('allowed', true, 'used', used, 'limit', lim);
end $$;
revoke execute on function public.consume_daily_message(text, integer, integer) from public, anon;
grant execute on function public.consume_daily_message(text, integer, integer) to authenticated;

create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if lower(new.email) = 'michael.hu@oxfordintelligence.co.uk' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_owner_admin after insert on auth.users for each row execute function public.grant_owner_admin();

insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where lower(email) = 'michael.hu@oxfordintelligence.co.uk'
on conflict do nothing;