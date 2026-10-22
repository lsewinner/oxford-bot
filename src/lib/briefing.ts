import { z } from "zod";

export const BRIEFING_SOURCES = ["trends", "calendar", "jira"] as const;
export type BriefingSource = (typeof BRIEFING_SOURCES)[number];
export const BRIEFING_SOURCE_LABELS: Record<BriefingSource, string> = {
  trends: "科技热点",
  calendar: "今日日程",
  jira: "Jira 待办",
};
export const BRIEFING_BATCH = 20;
export const TELEGRAM_MAX = 3900;

export const briefingInput = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(64).refine(isValidTimezone, "时区无效"),
  sources: z.array(z.enum(BRIEFING_SOURCES)).min(1).max(BRIEFING_SOURCES.length),
  telegramAccount: z.string().trim().max(200),
  telegramChatId: z.string().trim().regex(/^-?\d{1,20}$|^$/, "Chat ID 格式不正确"),
});

export function isValidTimezone(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Local calendar date and hour for a timezone. */
export function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Due once per local day, at or after the chosen hour (catches a missed hourly run). */
export function isBriefingDue(s: { enabled: boolean; hour: number; timezone: string; last_sent_on: string | null; telegram_chat_id: string }, now: Date) {
  if (!s.enabled || !s.telegram_chat_id) return false;
  const { date, hour } = localParts(now, s.timezone);
  return hour >= s.hour && s.last_sent_on !== date;
}

export function clampTelegram(text: string) {
  return text.length > TELEGRAM_MAX ? text.slice(0, TELEGRAM_MAX - 1) + "…" : text;
}
