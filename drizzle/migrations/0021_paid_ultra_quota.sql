CREATE OR REPLACE FUNCTION public.consume_daily_message(check_env text, free_limit integer, pro_limit integer, ultra_limit integer DEFAULT 800, paid_pro_limit integer DEFAULT 300)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); ctl public.account_controls; lim integer; used integer; today date := (now() at time zone 'utc')::date; ultra boolean; paid boolean;
begin
  if uid is null then return jsonb_build_object('allowed', false, 'reason', 'auth'); end if;
  select * into ctl from public.account_controls where user_id = uid;
  if ctl.banned then return jsonb_build_object('allowed', false, 'reason', 'banned'); end if;
  insert into public.usage_daily(user_id, day, count) values (uid, today, 0) on conflict do nothing;
  if public.has_role(uid, 'admin') then
    update public.usage_daily set count = count + 1 where user_id = uid and day = today returning count into used;
    return jsonb_build_object('allowed', true, 'used', used, 'unlimited', true);
  end if;
  ultra := coalesce(ctl.pro_granted and ctl.granted_tier = 'ultra' and (ctl.pro_until is null or ctl.pro_until > now()), false)
    or exists (select 1 from public.subscriptions where user_id = uid and environment = check_env
      and price_id in ('ultra_monthly', 'ultra_yearly')
      and ((status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())));
  paid := exists (select 1 from public.subscriptions where user_id = uid and environment = check_env
    and ((status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())));
  lim := coalesce(ctl.daily_limit, case when ultra then ultra_limit when paid then paid_pro_limit when public.has_active_subscription(uid, check_env) then pro_limit else free_limit end);
  update public.usage_daily set count = count + 1 where user_id = uid and day = today and count < lim returning count into used;
  if used is null then
    select count into used from public.usage_daily where user_id = uid and day = today;
    return jsonb_build_object('allowed', false, 'reason', 'quota', 'used', used, 'limit', lim);
  end if;
  return jsonb_build_object('allowed', true, 'used', used, 'limit', lim);
end $function$;
REVOKE ALL ON FUNCTION public.consume_daily_message(text, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_daily_message(text, integer, integer, integer, integer) TO authenticated;