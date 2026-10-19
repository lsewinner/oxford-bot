import { describe, expect, it } from "vitest";
import { catBreeds, isCatBreed } from "@/lib/cat-breeds";
import { guestConversationId, guestMessagesKey, isGuestConversation, parseGuestMessages } from "@/lib/guest-conversations";

describe("independent Bot conversations and avatars", () => {
  it("offers at least 30 distinct cat breeds with distinct images", () => {
    expect(catBreeds.length).toBeGreaterThanOrEqual(30);
    expect(new Set(catBreeds.map((cat) => cat.id)).size).toBe(catBreeds.length);
    expect(new Set(catBreeds.map((cat) => cat.asset)).size).toBe(catBreeds.length);
    expect(isCatBreed("chartreux")).toBe(true);
  });
  it("gives mail and website Bots different conversations and message storage", () => {
    const mail = guestConversationId("mail-bot");
    const website = guestConversationId("website-bot");
    expect(mail).not.toBe(website);
    expect(guestMessagesKey(mail)).not.toBe(guestMessagesKey(website));
    expect(guestMessagesKey(mail)).not.toBe(guestMessagesKey("guest"));
  });
  it("keeps local Bot conversations on the guest endpoint, never private thread access", () => {
    expect(isGuestConversation(guestConversationId("mail-bot"))).toBe(true);
    expect(isGuestConversation("private-thread")).toBe(false);
  });
  it("reads one conversation without inventing or mixing messages", () => {
    const mail = [{ id: "mail-1", role: "user", parts: [{ type: "text", text: "邮件专属问题" }] }];
    expect(parseGuestMessages(JSON.stringify(mail))).toEqual(mail);
    expect(parseGuestMessages(null)).toEqual([]);
  });
});