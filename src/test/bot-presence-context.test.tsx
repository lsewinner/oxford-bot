import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BotPresenceProvider, useBotPresence } from "@/components/chat/bot-presence";

describe("per-thread Bot presence", () => {
  it("settles a departed thread without losing its identity or another thread's state", () => {
    const { result } = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    act(() => {
      result.current.report("mail-thread", { bot: { name: "邮件 Bot", kind: "mail" }, status: "streaming" });
      result.current.report("code-thread", { bot: { name: "开发 Bot", kind: "code" }, status: "submitted" });
    });
    act(() => result.current.settle("mail-thread"));
    expect(result.current.activities["mail-thread"]?.status).toBe("ready");
    expect(result.current.activities["mail-thread"]?.bot?.kind).toBe("mail");
    expect(result.current.activities["code-thread"]?.status).toBe("submitted");
  });
});