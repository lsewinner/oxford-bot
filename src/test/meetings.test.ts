import { describe, expect, it } from "vitest";
import { buildDispatchPrompt, meetingToMarkdown, MEETING_SEGMENT_MS } from "@/lib/meetings";

const summary = { overview: "讨论上线", topics: [], decisions: ["周五上线"], actions: [{ task: "写发布说明", owner: "Michael", due: "周四" }] };

describe("meeting copilot", () => {
  it("dispatch prompt requires per-item confirmation and names the target", () => {
    const p = buildDispatchPrompt("asana", "周会", summary.actions);
    expect(p).toContain("Asana");
    expect(p).toContain("每条创建前都需要我确认");
    expect(p).toContain("1. 写发布说明（负责人：Michael）（截止：周四）");
  });
  it("brain markdown keeps decisions and actions", () => {
    const md = meetingToMarkdown("周会", "2026/10/22", summary);
    expect(md).toContain("- 周五上线");
    expect(md).toContain("写发布说明（负责人：Michael；截止：周四）");
  });
  it("segments stay well under the 20MB transcription limit at 32kbps", () => {
    expect((MEETING_SEGMENT_MS / 1000) * 32000 / 8).toBeLessThan(20 * 1024 * 1024);
  });
});
