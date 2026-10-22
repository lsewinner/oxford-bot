import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MEETING_MAX_TRANSCRIPT, meetingToMarkdown, type MeetingSummary } from "./meetings";

export type MeetingRow = { id: string; title: string; source: string; calendar_event: string; started_at: string | null; transcript: string; summary: MeetingSummary; brain_document_id: string | null; created_at: string };
export type UpcomingMeeting = { id: string; title: string; detail: string; provider: string };

export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("meeting_records").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("读取会议记录失败");
    return (data ?? []) as unknown as MeetingRow[];
  });

/** Read-only: today's remaining events from the caller's own connected calendars. */
export const upcomingMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ timeZone: z.string().max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { executeOperation } = await import("./connections/execute.server");
    const { getConnection } = await import("./connections/storage.server");
    const now = new Date();
    const start = new Date(now.getTime() - 2 * 3600_000).toISOString();
    const end = new Date(now.getTime() + 24 * 3600_000).toISOString();
    const out: UpcomingMeeting[] = [];
    let connected = false;
    for (const id of ["google_calendar", "microsoft_calendar"] as const) {
      const row = await getConnection(context.userId, id);
      if (!row?.enabled) continue;
      connected = true;
      try {
        const r = await executeOperation(context.userId, id, { operation: "events", start, end, timeZone: data.timeZone });
        if (r.status === "completed") for (const [i, item] of (r.items ?? []).slice(0, 15).entries()) out.push({ id: `${id}-${i}`, title: item.title, detail: item.detail ?? "", provider: r.provider });
      } catch { /* one calendar failing should not hide the other */ }
    }
    return { connected, events: out };
  });

export const analyzeMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(200),
    source: z.enum(["calendar", "record", "upload"]),
    calendarEvent: z.string().max(2000).default(""),
    startedAt: z.string().datetime().optional(),
    transcript: z.string().trim().min(20, "逐字稿太短，无法生成纪要").max(MEETING_MAX_TRANSCRIPT),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { summarizeMeeting } = await import("./meetings.server");
    const summary = await summarizeMeeting(data.title, data.transcript, data.calendarEvent ? `日程信息：${data.calendarEvent}` : "");
    const { data: row, error } = await context.supabase.from("meeting_records").insert({
      user_id: context.userId, title: data.title, source: data.source, calendar_event: data.calendarEvent,
      started_at: data.startedAt ?? null, transcript: data.transcript, summary: summary as never,
    }).select("*").single();
    if (error || !row) throw new Error("保存会议记录失败");
    return row as unknown as MeetingRow;
  });

export const saveMeetingToBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase.from("meeting_records").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!m) throw new Error("会议记录不存在");
    if (m.brain_document_id) return { documentId: m.brain_document_id };
    const date = new Date(m.started_at ?? m.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const text = `${meetingToMarkdown(m.title, date, m.summary as unknown as MeetingSummary)}\n\n## 逐字稿\n${m.transcript}`;
    const { ingestBrainText } = await import("./brain.server");
    const documentId = await ingestBrainText(context.supabase, context.userId, `会议纪要 · ${m.title}`, text);
    await context.supabase.from("meeting_records").update({ brain_document_id: documentId }).eq("id", m.id);
    return { documentId };
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meeting_records").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("删除失败");
    return { ok: true };
  });
