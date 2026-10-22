import { z } from "zod";

export const MEETING_MAX_TRANSCRIPT = 200_000;
/** Recordings rotate into separate complete files so each stays under the transcription upload limit. */
export const MEETING_SEGMENT_MS = 8 * 60_000;

export const meetingSummarySchema = z.object({
  overview: z.string(),
  topics: z.array(z.object({ title: z.string(), points: z.array(z.string()) })),
  decisions: z.array(z.string()),
  actions: z.array(z.object({ task: z.string(), owner: z.string(), due: z.string() })),
});
export type MeetingSummary = z.infer<typeof meetingSummarySchema>;
export type MeetingAction = MeetingSummary["actions"][number];

export const DISPATCH_TARGETS = [
  { id: "jira", label: "Jira" },
  { id: "asana", label: "Asana" },
  { id: "clickup", label: "ClickUp" },
] as const;
export type DispatchTarget = (typeof DISPATCH_TARGETS)[number]["id"];

export function meetingToMarkdown(title: string, date: string, s: MeetingSummary): string {
  const lines = [`# 会议纪要：${title}`, `日期：${date}`, "", "## 概要", s.overview, ""];
  if (s.topics.length) {
    lines.push("## 议题");
    for (const t of s.topics) { lines.push(`### ${t.title}`); for (const p of t.points) lines.push(`- ${p}`); }
    lines.push("");
  }
  lines.push("## 决议", ...(s.decisions.length ? s.decisions.map((d) => `- ${d}`) : ["- 无"]), "");
  lines.push("## 待办", ...(s.actions.length ? s.actions.map((a) => `- ${a.task}（负责人：${a.owner || "未指定"}；截止：${a.due || "未指定"}）`) : ["- 无"]));
  return lines.join("\n");
}

/** Builds a chat request; the real write still goes through the normal per-item confirmation card. */
export function buildDispatchPrompt(target: DispatchTarget, title: string, actions: MeetingAction[]): string {
  const label = DISPATCH_TARGETS.find((t) => t.id === target)?.label ?? target;
  const list = actions.map((a, i) => `${i + 1}. ${a.task}${a.owner ? `（负责人：${a.owner}）` : ""}${a.due ? `（截止：${a.due}）` : ""}`).join("\n");
  return `请把会议「${title}」的以下待办事项逐条创建到我的 ${label}。先读取可用的项目/列表，若有多个请问我选哪个；每条创建前都需要我确认。\n\n${list}`;
}
