import type { UIMessage } from "ai";
import { messagePreview } from "@/lib/message-preview";

export const guestConversationId = (botId?: string) => botId ? `guest:bot:${botId}` : "guest";
export const guestMessagesKey = (conversationId: string) => conversationId === "guest" ? "oxford:guest-messages:v1" : `oxford:guest-messages:v1:${conversationId}`;
export const isGuestConversation = (id: string) => id === "guest" || id.startsWith("guest:");

export function parseGuestMessages(raw: string | null): UIMessage[] {
  try {
    const saved: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(saved) ? saved.filter((message) => typeof message?.id === "string" && ["user", "assistant"].includes(message.role) && Array.isArray(message.parts)) : [];
  } catch { return []; }
}

/** Latest locally saved message preview + timestamp for a guest conversation (WeChat-style sidebar line). */
export function guestLastActivity(conversationId: string): { preview: string; time?: string | undefined } {
  if (typeof window === "undefined") return { preview: "" };
  const messages = parseGuestMessages(localStorage.getItem(guestMessagesKey(conversationId)));
  const createdAt = (messages[messages.length - 1] as { createdAt?: string } | undefined)?.createdAt;
  return { preview: messagePreview(messages), time: createdAt ?? undefined };
}