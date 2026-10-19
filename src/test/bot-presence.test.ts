import { describe, expect, it } from "vitest";
import { botFromMessages, botFromRequest, botsFromMessages, botIsWorking, mergeBotEntries } from "@/lib/bot-presence";

describe("Bot request identity and execution state", () => {
  it("adds a GitHub Bot below the mail Bot in the same conversation without duplicate streaming entries", () => {
    const entries = botsFromMessages("guest", [
      { id: "mail", role: "user", parts: [{ type: "text", text: "建立一个邮件BOT" }] },
      { id: "github", role: "user", parts: [{ type: "text", text: "再建立一个帮我连接GITHUB搭建网站的BOT" }] },
    ]);
    expect(entries.map((entry) => entry.bot.kind)).toEqual(["mail", "code"]);
    expect(entries.map((entry) => entry.id)).toEqual(["guest:mail", "guest:github"]);
    expect(mergeBotEntries(entries, entries)).toHaveLength(2);
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