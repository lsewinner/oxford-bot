export type ProFeature = "bot" | "persona" | "deep_think" | "tools" | "general";
export type BillingCycle = "monthly" | "yearly";

export const PRO_PRICES: Record<BillingCycle, { priceId: "pro_monthly" | "pro_yearly"; amount: number; label: string; note: string }> = {
  monthly: { priceId: "pro_monthly", amount: 25, label: "$25", note: "/ 月" },
  yearly: { priceId: "pro_yearly", amount: 240, label: "$240", note: "/ 年 · 折合 $20/月，省 20%" },
};

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

export const PLAN_ROWS: { label: string; free: string | boolean; pro: string | boolean }[] = [
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
