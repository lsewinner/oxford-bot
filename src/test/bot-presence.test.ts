import { describe, expect, it } from "vitest";
import { botFromMessages, botFromRequest, botsFromMessages, botIsWorking, mergeBotEntries, normalizeBotName, parseBotEntries } from "@/lib/bot-presence";

describe("Bot request identity and execution state", () => {
  it("recognizes a website Bot without requiring GitHub or code keywords", () => {
    expect(botFromRequest("再帮我建立一个bot来帮我建立网站")).toEqual({ name: "建站 Bot", kind: "code" });
  });
  it("recognizes a code-writing Bot", () => {
    expect(botFromRequest("做一个写代码的bot")).toEqual({ name: "开发 Bot", kind: "code" });
  });
  it("renames stored Nightwave entries to Oxford Bot on read", () => {
    expect(normalizeBotName("Nightwave AI Chat")).toBe("Oxford Bot");
    expect(normalizeBotName("nightwave chat")).toBe("Oxford Bot");
    expect(normalizeBotName("邮件 Bot")).toBe("邮件 Bot");
    expect(parseBotEntries('[{"id":"a","threadId":"guest","messageId":"a","bot":{"name":"Nightwave AI Chat","kind":"mail"}}]')[0]?.bot.name).toBe("Oxford Bot");
  });
  it("rejects corrupted stored entries instead of rendering unknown cat breeds", () => {
    expect(parseBotEntries('{"entries":[]}')).toEqual([]);
    expect(parseBotEntries('[{"id":"a","threadId":"guest","messageId":"a","bot":{"name":"cat","kind":"unknown"}}]')).toEqual([]);
  });
  it("adds a GitHub Bot below the mail Bot in the same conversation without duplicate streaming entries", () => {
    const entries = botsFromMessages("guest", [
      { id: "mail", role: "user", parts: [{ type: "text", text: "建立一个邮件BOT" }] },
      { id: "github", role: "user", parts: [{ type: "text", text: "再建立一个帮我连接GITHUB搭建网站的BOT" }] },
    ]);
    expect(entries.map((entry) => entry.bot.kind)).toEqual(["mail", "code"]);
    expect(entries.map((entry) => entry.id)).toEqual(["guest:mail", "guest:github"]);
    expect(mergeBotEntries(entries, entries)).toHaveLength(2);
  });
  it("merges explicit saved overrides and conversation links into an already registered history Bot", () => {
    const initial = { id: "source:mail", threadId: "source", messageId: "mail", bot: { name: "邮件 Bot", kind: "mail" as const } };
    const saved = { ...initial, conversationId: "dedicated", overrides: { name: "自定义猫", breed: "chartreux" as const } };
    const merged = mergeBotEntries([initial], [saved]);
    expect(merged[0]?.bot).toEqual({ name: "自定义猫", kind: "mail", breed: "chartreux" });
    expect(merged[0]?.conversationId).toBe("dedicated");
    expect(mergeBotEntries(merged, [initial])[0]?.bot.name).toBe("自定义猫");
    expect(parseBotEntries(JSON.stringify(merged))[0]?.bot.breed).toBe("chartreux");
  });
  it("recognizes a requested mail Bot without treating ordinary mail questions as creation", () => {
    expect(botFromRequest("我需要你帮我建立一个bot让它来看我的邮箱")?.kind).toBe("mail");
    expect(botFromRequest("帮我总结邮件")).toBeNull();
  });
  it("derives identity from user requests, not assistant claims", () => {
    expect(botFromMessages([{ id: "a", role: "assistant", parts: [{ type: "text", text: "可以创建一个邮件bot" }] }])).toBeNull();
  });
  it("animates only for an actual pending or streaming response", () => {
    expect(botIsWorking("submitted")).toBe(true);
    expect(botIsWorking("streaming")).toBe(true);
    expect(botIsWorking("ready")).toBe(false);
    expect(botIsWorking("error")).toBe(false);
  });
});