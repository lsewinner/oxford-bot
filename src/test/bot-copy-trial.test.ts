import { describe, expect, it, beforeEach } from "vitest";
import { queueBotCopy, takeBotCopy, trialFromMessages } from "@/lib/bot-copy";

describe("Bot copy carries trial chat", () => {
  beforeEach(() => sessionStorage.clear());
  it("keeps only text from trial messages and drops tool parts", () => {
    const trial = trialFromMessages([
      { role: "user", parts: [{ type: "text", text: "你好" }] },
      { role: "assistant", parts: [{ type: "tool-service_x", output: {} }, { type: "text", text: "喵" }] },
      { role: "system", parts: [{ type: "text", text: "secret" }] },
    ]);
    expect(trial).toEqual([{ role: "user", text: "你好" }, { role: "assistant", text: "喵" }]);
  });
  it("hands the trial over exactly once", () => {
    queueBotCopy({ name: "小样", kind: "general" }, [{ role: "user", text: "你好" }]);
    expect(takeBotCopy()?.trial).toEqual([{ role: "user", text: "你好" }]);
    expect(takeBotCopy()).toBeNull();
  });
});
