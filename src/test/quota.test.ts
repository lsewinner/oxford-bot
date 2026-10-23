import { describe, expect, it } from "vitest";
import { effectiveDailyLimit, FREE_DAILY_MESSAGES, PRO_DAILY_MESSAGES, PAID_PRO_DAILY_MESSAGES, ULTRA_DAILY_MESSAGES } from "@/lib/quota";

describe("daily message quota", () => {
  it("free 30, granted Pro 100, paid Pro 300, Ultra 800 per day", () => {
    expect(FREE_DAILY_MESSAGES).toBe(30);
    expect(PRO_DAILY_MESSAGES).toBe(100);
    expect(ULTRA_DAILY_MESSAGES).toBe(800);
    expect(PAID_PRO_DAILY_MESSAGES).toBe(300);
    expect(effectiveDailyLimit(null, "paid_pro")).toBe(300);
    expect(effectiveDailyLimit(null, "free")).toBe(30);
    expect(effectiveDailyLimit(null, "pro")).toBe(100);
    expect(effectiveDailyLimit(null, "ultra")).toBe(800);
  });
  it("an admin-set limit overrides the plan default", () => {
    expect(effectiveDailyLimit(5, "ultra")).toBe(5);
    expect(effectiveDailyLimit(0, false)).toBe(0);
  });
});
