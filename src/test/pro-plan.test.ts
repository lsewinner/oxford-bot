import { describe, expect, it } from "vitest";
import { canAddBot, PRO_PRICES, ULTRA_PRICES, paidPlanForPrice, membershipPlan, subscriptionActive } from "@/lib/pro";
import { effectiveDailyLimit } from "@/lib/quota";

const now = Date.parse("2026-10-19T00:00:00Z");
const future = "2026-11-19T00:00:00Z";
const past = "2026-09-19T00:00:00Z";

describe("Pro plan rules", () => {
  it("prices Ultra at $60 monthly", () => {
    expect(ULTRA_PRICES.monthly).toMatchObject({ priceId: "ultra_monthly", amount: 60 });
  });
  it("prices Ultra at $576 yearly with 20% savings", () => {
    expect(ULTRA_PRICES.yearly).toMatchObject({ priceId: "ultra_yearly", amount: 576 });
    expect(ULTRA_PRICES.yearly.amount / 12).toBe(48);
    expect(ULTRA_PRICES.yearly.amount / (ULTRA_PRICES.monthly.amount * 12)).toBe(0.8);
  });
  it("paid Ultra gets 800 daily messages for either billing cycle", () => {
    for (const price_id of ["ultra_monthly", "ultra_yearly"]) {
      const plan = membershipPlan({ status: "active", current_period_end: future, price_id }, null, now);
      expect(plan).toBe("ultra");
      expect(effectiveDailyLimit(null, plan === "ultra" ? "ultra" : "paid_pro")).toBe(800);
    }
    expect(paidPlanForPrice("pro_monthly")).toBe("pro");
    expect(paidPlanForPrice("unknown")).toBeNull();
  });
  it("Ultra grant wins over paid Pro and expires without removing paid Pro", () => {
    const sub = { status: "active", current_period_end: future, price_id: "pro_yearly" };
    expect(membershipPlan(sub, { pro_granted: true, pro_until: future, granted_tier: "ultra" }, now)).toBe("ultra");
    expect(membershipPlan(sub, { pro_granted: true, pro_until: past, granted_tier: "ultra" }, now)).toBe("pro");
    expect(membershipPlan({ ...sub, price_id: "ultra_monthly", current_period_end: past }, null, now)).toBeNull();
  });
  it("prices Pro at $25 monthly and $240 yearly", () => {
    expect(PRO_PRICES.monthly).toMatchObject({ priceId: "pro_monthly", amount: 25 });
    expect(PRO_PRICES.yearly).toMatchObject({ priceId: "pro_yearly", amount: 240 });
  });
  it("free accounts may raise one cat Bot beyond Oxonian, no more", () => {
    expect(canAddBot(false, 0)).toBe(true);
    expect(canAddBot(false, 1)).toBe(false);
    expect(canAddBot(true, 5)).toBe(true);
  });
  it("active subscription unlocks Pro", () => {
    expect(subscriptionActive({ status: "active", current_period_end: future }, now)).toBe(true);
  });
  it("canceled keeps Pro until period end, then downgrades", () => {
    expect(subscriptionActive({ status: "canceled", current_period_end: future }, now)).toBe(true);
    expect(subscriptionActive({ status: "canceled", current_period_end: past }, now)).toBe(false);
  });
  it("expired or unpaid subscriptions are free", () => {
    expect(subscriptionActive({ status: "active", current_period_end: past }, now)).toBe(false);
    expect(subscriptionActive({ status: "unpaid", current_period_end: future }, now)).toBe(false);
    expect(subscriptionActive(null, now)).toBe(false);
  });
});
