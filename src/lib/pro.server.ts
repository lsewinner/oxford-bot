import type { SupabaseClient } from "@supabase/supabase-js";
import { serverPaymentsEnv } from "./stripe.server";

/** Server-side Pro check; environment comes from the build, never from the caller. */
export async function isProUser(supabase: SupabaseClient<any> | null | undefined, userId: string | null | undefined) {
  if (!supabase || !userId) return false;
  const env = serverPaymentsEnv();
  if (!env) return false;
  const { data, error } = await supabase.rpc("has_active_subscription", { user_uuid: userId, check_env: env });
  return !error && data === true;
}

export async function requirePro(supabase: SupabaseClient<any>, userId: string) {
  if (!(await isProUser(supabase, userId))) throw new Error("该功能需要 Pro 会员，请先升级");
}
