import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BotPresenceProvider, useBotPresence } from "@/components/chat/bot-presence";

describe("per-thread Bot presence", () => {
  it("keeps each Bot's name and selected breed independent across registration updates", () => {
    const { result } = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    const entries = [
      { id: "guest:mail", threadId: "guest", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" as const } },
      { id: "guest:code", threadId: "guest", messageId: "code", bot: { name: "开发 Bot", kind: "code" as const } },
    ];
    act(() => result.current.register(entries));
    act(() => result.current.update("guest:code", { name: "建站猫", kind: "code", breed: "document" }));
    act(() => result.current.register(entries));
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]?.bot).toEqual({ name: "邮件 Bot", kind: "mail" });
    expect(result.current.entries[1]?.bot).toEqual({ name: "建站猫", kind: "code", breed: "document" });
  });
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