/** Default daily message quotas (UTC day). Admin overrides replace these per account. */
export const FREE_DAILY_MESSAGES = 30;
/** Admin-granted Pro. */
export const PRO_DAILY_MESSAGES = 100;
/** Stripe-paid Pro. */
export const PAID_PRO_DAILY_MESSAGES = 300;
export const ULTRA_DAILY_MESSAGES = 800;

export type Tier = "free" | "pro" | "paid_pro" | "ultra";

export type QuotaResult = { allowed: boolean; reason?: "auth" | "banned" | "quota"; used?: number; limit?: number };

export function quotaDeniedMessage(result: QuotaResult) {
  if (result.reason === "banned") return "该账号已被停用，如有疑问请联系 info@oxfordintelligence.co.uk";
  if (result.reason === "auth") return "请先登录";
  return `今日消息额度已用完（${result.used ?? 0}/${result.limit ?? 0}），明天 UTC 0 点重置，或升级获得更多额度`;
}

export function tierDailyLimit(tier: Tier) {
  return tier === "ultra" ? ULTRA_DAILY_MESSAGES : tier === "paid_pro" ? PAID_PRO_DAILY_MESSAGES : tier === "pro" ? PRO_DAILY_MESSAGES : FREE_DAILY_MESSAGES;
}

export function effectiveDailyLimit(override: number | null | undefined, tier: Tier | boolean) {
  const t: Tier = typeof tier === "boolean" ? (tier ? "pro" : "free") : tier;
  return override ?? tierDailyLimit(t);
}
