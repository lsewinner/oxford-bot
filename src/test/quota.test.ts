import { describe, expect, it } from "vitest";
import { effectiveDailyLimit, FREE_DAILY_MESSAGES, PRO_DAILY_MESSAGES } from "@/lib/quota";

describe("daily message quota", () => {
  it("free accounts default to 30 messages per day, Pro to 500", () => {
    expect(FREE_DAILY_MESSAGES).toBe(30);
    expect(PRO_DAILY_MESSAGES).toBe(500);
    expect(effectiveDailyLimit(null, false)).toBe(30);
    expect(effectiveDailyLimit(null, true)).toBe(500);
  });
  it("an admin-set limit overrides the plan default", () => {
    expect(effectiveDailyLimit(5, true)).toBe(5);
    expect(effectiveDailyLimit(0, false)).toBe(0);
  });
});
