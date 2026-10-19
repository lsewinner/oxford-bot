import { describe, expect, it } from "vitest";
import { formatChatTime } from "@/lib/chat-time";

describe("formatChatTime (WeChat style)", () => {
  it("shows clock time for today", () => {
    const now = new Date();
    const label = formatChatTime(new Date(now.getTime() - 60_000).toISOString());
    expect(label).toMatch(/^\d{2}:\d{2}$/);
  });

  it("shows 昨天 for yesterday", () => {
    const d = new Date(Date.now() - 26 * 3_600_000);
    // Guard against crossing two midnights in edge timezones.
    const expected = Math.round((new Date(new Date().setHours(0, 0, 0, 0)).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000) === 1 ? "昨天" : formatChatTime(d.toISOString());
    expect(formatChatTime(d.toISOString())).toBe(expected);
  });

  it("shows M月D日 for older messages this year", () => {
    const d = new Date(Date.now() - 10 * 86_400_000);
    expect(formatChatTime(d.toISOString())).toBe(`${d.getMonth() + 1}月${d.getDate()}日`);
  });

  it("returns empty for missing input", () => {
    expect(formatChatTime(undefined)).toBe("");
  });
});
