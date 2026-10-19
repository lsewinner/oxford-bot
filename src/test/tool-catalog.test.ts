import { describe, expect, it } from "vitest";
import { allowedToolIds, simulateTool } from "@/lib/tool-catalog";
describe("tool selection safety", () => {
  it("only exposes known tools and deduplicates the selection", () => {
    expect(allowedToolIds(["google_mail", "google_mail", "admin_delete"])).toEqual(["google_mail"]);
  });
  it("never reports simulated mail as a real external operation", () => {
    const result = simulateTool("google_mail", "send email");
    expect(result.mode).toBe("simulation");
    expect(result.status).toBe("completed");
    expect(result.summary).toContain("未读取或更改任何外部数据");
  });
});