export type ProFeature = "bot" | "persona" | "deep_think" | "tools" | "general";
export type BillingCycle = "monthly" | "yearly";
export type PaidPlan = "pro" | "ultra";
export type PlanPriceId = "pro_monthly" | "pro_yearly" | "ultra_monthly" | "ultra_yearly";

export const PRO_PRICES: Record<BillingCycle, { priceId: "pro_monthly" | "pro_yearly"; amount: number; label: string; note: string }> = {
  monthly: { priceId: "pro_monthly", amount: 25, label: "$25", note: "/ 月" },
  yearly: { priceId: "pro_yearly", amount: 240, label: "$240", note: "/ 年 · 折合 $20/月，省 20%" },
};

export const ULTRA_PRICES: Record<BillingCycle, { priceId: PlanPriceId; amount: number; label: string; note: string }> = {
  monthly: { priceId: "ultra_monthly", amount: 60, label: "$60", note: "/ 月" },
  yearly: { priceId: "ultra_yearly", amount: 576, label: "$576", note: "/ 年 · 折合 $48/月，省 20%" },
};
export const PLAN_PRICES = { pro: PRO_PRICES, ultra: ULTRA_PRICES };

export function paidPlanForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (priceId === "ultra_monthly" || priceId === "ultra_yearly") return "ultra";
  if (priceId === "pro_monthly" || priceId === "pro_yearly") return "pro";
  return null;
}

export function membershipPlan(subscription: (SubRow & { price_id: string }) | null | undefined, grant: { pro_granted: boolean; pro_until: string | null; granted_tier: string | null } | null | undefined, now = Date.now()): PaidPlan | null {
  const paid = subscriptionActive(subscription, now) ? paidPlanForPrice(subscription?.price_id) ?? "pro" : null;
  const granted = grant?.pro_granted && (!grant.pro_until || Date.parse(grant.pro_until) > now) ? (grant.granted_tier === "ultra" ? "ultra" : "pro") : null;
  return paid === "ultra" || granted === "ultra" ? "ultra" : paid ?? granted;
}

/** Free accounts get the pinned main Bot (Oxonian) plus one cat Bot of their own; more need Pro. */
export const FREE_EXTRA_BOTS = 1;

export function canAddBot(isPro: boolean, extraBotCount: number) {
  return isPro || extraBotCount < FREE_EXTRA_BOTS;
}

export const FEATURE_PROMPTS: Record<ProFeature, string> = {
  bot: "免费版可以在 Oxonian 之外养 1 只专属猫咪 Bot。升级 Pro 即可不限数量地养更多猫咪 Bot。",
  persona: "自定义专属人设与说话风格是 Pro 权益。",
  deep_think: "Deep Think 深度思考是 Pro 权益。",
  tools: "连接 Gmail、Outlook、GitHub 等真实工具是 Pro 权益。",
  general: "解锁 Oxford Bot 的全部能力。",
};

export const PLAN_ROWS: { label: string; free: string | boolean; pro: string | boolean; ultra: string | boolean }[] = [
  { label: "每日消息额度（UTC 0 点重置）", free: "30 条", pro: "300 条", ultra: "800 条" },
  { label: "对话、联网搜索、生图与文件分析", free: true, pro: true },
  { label: "猫咪 Bot", free: "Oxonian + 1 只自建", pro: "不限数量" },
  { label: "自定义专属人设与说话风格", free: false, pro: true },
  { label: "Deep Think 深度思考", free: false, pro: true },
  { label: "连接真实工具（邮件、云盘、GitHub、Teams 等）", free: false, pro: true },
];

type SubRow = { status: string; current_period_end: string | null };
export function subscriptionActive(row: SubRow | null | undefined, now = Date.now()) {
  if (!row) return false;
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  if (["active", "trialing", "past_due"].includes(row.status)) return end === null || end > now;
  if (row.status === "canceled") return end !== null && end > now;
  return false;
}
