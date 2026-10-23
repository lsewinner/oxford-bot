import { describe, expect, it } from "vitest";
import { effectiveDailyLimit, FREE_DAILY_MESSAGES, PRO_DAILY_MESSAGES, ULTRA_DAILY_MESSAGES } from "@/lib/quota";

describe("daily message quota", () => {
  it("free 30, Pro 100, Ultra 500 per day", () => {
    expect(FREE_DAILY_MESSAGES).toBe(30);
    expect(PRO_DAILY_MESSAGES).toBe(100);
    expect(ULTRA_DAILY_MESSAGES).toBe(500);
    expect(effectiveDailyLimit(null, "free")).toBe(30);
    expect(effectiveDailyLimit(null, "pro")).toBe(100);
    expect(effectiveDailyLimit(null, "ultra")).toBe(500);
  });
  it("an admin-set limit overrides the plan default", () => {
    expect(effectiveDailyLimit(5, "ultra")).toBe(5);
    expect(effectiveDailyLimit(0, false)).toBe(0);
  });
});
