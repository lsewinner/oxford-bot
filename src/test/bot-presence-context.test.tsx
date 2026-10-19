import { act, renderHook } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { botStorageKey } from "@/lib/bot-presence";
import { BotPresenceProvider, useBotPresence } from "@/components/chat/bot-presence";

describe("per-thread Bot presence", () => {
  beforeEach(() => localStorage.clear());
  it("persists separate target conversations and new cat selections without re-registering duplicates", () => {
    const first = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    const entries = [
      { id: "source:mail", threadId: "source", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" as const } },
      { id: "source:website", threadId: "source", messageId: "website", bot: { name: "建站 Bot", kind: "code" as const } },
    ];
    act(() => first.result.current.register(entries));
    act(() => first.result.current.linkConversation("source:mail", "mail-chat"));
    act(() => first.result.current.linkConversation("source:website", "website-chat"));
    act(() => first.result.current.update("source:website", { name: "建站猫", kind: "code", breed: "chartreux" }));
    act(() => first.result.current.register(entries));
    first.unmount();
    const restored = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    expect(restored.result.current.entries.map((entry) => entry.conversationId)).toEqual(["mail-chat", "website-chat"]);
    expect(restored.result.current.entries[1]?.bot).toEqual({ name: "建站猫", kind: "code", breed: "chartreux" });
  });
  it("restores independent Bot names and breeds after remount", () => {
    const first = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    act(() => first.result.current.register([
      { id: "guest:mail", threadId: "guest", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" } },
      { id: "guest:website", threadId: "guest", messageId: "website", bot: { name: "建站 Bot", kind: "code" } },
    ]));
    act(() => first.result.current.update("guest:website", { name: "建站猫", kind: "code", breed: "document" }));
    first.unmount();
    const second = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    expect(second.result.current.entries.map((entry) => entry.bot.name)).toEqual(["邮件 Bot", "建站猫"]);
    expect(second.result.current.entries[1]?.bot.breed).toBe("document");
  });
  it("isolates persisted Bots by account", () => {
    localStorage.setItem(botStorageKey("another-account"), JSON.stringify([{ id: "private:a", threadId: "private", messageId: "a", bot: { name: "私人 Bot", kind: "mail" } }]));
    const guest = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    expect(guest.result.current.entries).toEqual([]);
  });
  it("restores saved edits even when history registers before the provider mount effect", () => {
    const initial = { id: "source:mail", threadId: "source", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" as const } };
    localStorage.setItem(botStorageKey("guest"), JSON.stringify([{ ...initial, bot: { ...initial.bot, name: "我的邮件猫", breed: "chartreux" }, conversationId: "dedicated" }]));
    const hook = renderHook(() => {
      const presence = useBotPresence();
      useEffect(() => { presence.register([initial]); }, [presence.register]);
      return presence;
    }, { wrapper: BotPresenceProvider });
    expect(hook.result.current.entries[0]?.bot).toEqual({ name: "我的邮件猫", kind: "mail", breed: "chartreux" });
    expect(hook.result.current.entries[0]?.conversationId).toBe("dedicated");
    act(() => hook.result.current.register([initial]));
    expect(hook.result.current.entries[0]?.bot.name).toBe("我的邮件猫");
    expect(JSON.parse(localStorage.getItem(botStorageKey("guest")) ?? "[]")[0].bot.breed).toBe("chartreux");
  });
  it("restores each scope without copying another account's edits or activity", () => {
    const wrapper = ({ children, scope }: { children: ReactNode; scope: string }) => <BotPresenceProvider scope={scope}>{children}</BotPresenceProvider>;
    let scope = "alice";
    const hook = renderHook(() => useBotPresence(), { wrapper: ({ children }) => wrapper({ children, scope }) });
    act(() => hook.result.current.register([{ id: "a:mail", threadId: "a", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" } }]));
    act(() => hook.result.current.update("a:mail", { name: "Alice 猫", kind: "mail", breed: "chartreux" }));
    scope = "bob";
    hook.rerender();
    expect(hook.result.current.entries).toEqual([]);
    expect(JSON.parse(localStorage.getItem(botStorageKey("bob")) ?? "[]")).toEqual([]);
    scope = "alice";
    hook.rerender();
    expect(hook.result.current.entries[0]?.bot).toEqual({ name: "Alice 猫", kind: "mail", breed: "chartreux" });
    expect(hook.result.current.entries[0]?.overrides).toEqual({ name: "Alice 猫", breed: "chartreux" });
  });
  it("removes associated Bots when their conversation is deleted", () => {
    const { result } = renderHook(() => useBotPresence(), { wrapper: BotPresenceProvider });
    act(() => result.current.register([{ id: "thread:a", threadId: "thread", messageId: "a", bot: { name: "邮件 Bot", kind: "mail" } }]));
    act(() => result.current.removeThread("thread"));
    expect(result.current.entries).toEqual([]);
    expect(JSON.parse(localStorage.getItem(botStorageKey("guest")) ?? "[]")).toEqual([]);
  });
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