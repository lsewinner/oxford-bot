import { describe, expect, it } from "vitest";
import { botFromMessages, botFromRequest, botIsWorking } from "@/lib/bot-presence";

describe("Bot request identity and execution state", () => {
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