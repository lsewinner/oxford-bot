import type { UIMessage } from "ai";

export const guestConversationId = (botId?: string) => botId ? `guest:bot:${botId}` : "guest";
export const guestMessagesKey = (conversationId: string) => conversationId === "guest" ? "oxford:guest-messages:v1" : `oxford:guest-messages:v1:${conversationId}`;
export const isGuestConversation = (id: string) => id === "guest" || id.startsWith("guest:");

export function parseGuestMessages(raw: string | null): UIMessage[] {
  try {
    const saved: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(saved) ? saved.filter((message) => typeof message?.id === "string" && ["user", "assistant"].includes(message.role) && Array.isArray(message.parts)) : [];
  } catch { return []; }
}