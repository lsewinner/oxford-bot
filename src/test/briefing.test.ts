import { describe, expect, it } from "vitest";
import { clampTelegram, isBriefingDue, localParts, TELEGRAM_MAX } from "@/lib/briefing";

const base = { enabled: true, hour: 9, timezone: "Asia/Shanghai", last_sent_on: null as string | null, telegram_chat_id: "123" };
describe("daily briefing schedule", () => {
  it("uses the user's local date and hour", () => {
    expect(localParts(new Date("2026-10-22T01:30:00Z"), "Asia/Shanghai")).toEqual({ date: "2026-10-22", hour: 9 });
  });
  it("is due at the chosen local hour", () => {
    expect(isBriefingDue(base, new Date("2026-10-22T01:00:00Z"))).toBe(true);
  });
  it("is not due before the chosen hour", () => {
    expect(isBriefingDue(base, new Date("2026-10-22T00:59:00Z"))).toBe(false);
  });
  it("sends at most once per local day", () => {
    expect(isBriefingDue({ ...base, last_sent_on: "2026-10-22" }, new Date("2026-10-22T05:00:00Z"))).toBe(false);
  });
  it("never sends when disabled or without a chat", () => {
    expect(isBriefingDue({ ...base, enabled: false }, new Date("2026-10-22T02:00:00Z"))).toBe(false);
    expect(isBriefingDue({ ...base, telegram_chat_id: "" }, new Date("2026-10-22T02:00:00Z"))).toBe(false);
  });
  it("fits Telegram's message limit", () => {
    expect(clampTelegram("a".repeat(5000)).length).toBe(TELEGRAM_MAX);
  });
});
