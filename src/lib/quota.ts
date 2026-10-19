/** Default daily message quotas (UTC day). Admin overrides replace these per account. */
export const FREE_DAILY_MESSAGES = 30;
export const PRO_DAILY_MESSAGES = 500;

export type QuotaResult = { allowed: boolean; reason?: "auth" | "banned" | "quota"; used?: number; limit?: number };

export function quotaDeniedMessage(result: QuotaResult) {
  if (result.reason === "banned") return "该账号已被停用，如有疑问请联系 info@oxfordintelligence.co.uk";
  if (result.reason === "auth") return "请先登录";
  return `今日消息额度已用完（${result.used ?? 0}/${result.limit ?? 0}），明天 UTC 0 点重置，或升级 Pro 获得更多额度`;
}

export function effectiveDailyLimit(override: number | null | undefined, isPro: boolean) {
  return override ?? (isPro ? PRO_DAILY_MESSAGES : FREE_DAILY_MESSAGES);
}
