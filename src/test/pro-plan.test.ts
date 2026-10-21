import { describe, expect, it } from "vitest";
import { canAddBot, PRO_PRICES, subscriptionActive } from "@/lib/pro";

const now = Date.parse("2026-10-19T00:00:00Z");
const future = "2026-11-19T00:00:00Z";
const past = "2026-09-19T00:00:00Z";

describe("Pro plan rules", () => {
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
