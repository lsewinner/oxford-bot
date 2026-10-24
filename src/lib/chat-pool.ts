import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

/**
 * Global pool of live chats keyed by thread id. A chat lives here (not in the
 * window component) so switching threads or Bots never aborts a reply that is
 * still being generated; the request keeps streaming in the background.
 */
export type ChatContext = {
  body: () => Record<string, unknown>;
  headers: () => Promise<Record<string, string>>;
  onError: (e: Error) => void;
  onFinish: (messages: UIMessage[]) => void;
  onStatus: (status: Chat<UIMessage>["status"]) => void;
};

type Entry = { chat: Chat<UIMessage>; ctx: ChatContext; mounted: number };
const pool = new Map<string, Entry>();

export function isBusy(chat: Chat<UIMessage>) {
  return chat.status === "submitted" || chat.status === "streaming";
}

export function acquireChat(threadId: string, initialMessages: UIMessage[], ctx: ChatContext) {
  let entry = pool.get(threadId);
  if (!entry) {
    const holder = { ctx } as { ctx: ChatContext };
    const chat = new Chat<UIMessage>({
      id: threadId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        headers: () => holder.ctx.headers(),
        body: () => holder.ctx.body(),
      }),
      onError: (e) => holder.ctx.onError(e),
      onFinish: ({ messages }) => {
        holder.ctx.onFinish(messages);
        const current = pool.get(threadId);
        if (current && current.mounted === 0) pool.delete(threadId);
      },
    });
    entry = { chat, ctx, mounted: 0 };
    Object.defineProperty(holder, "ctx", { get: () => pool.get(threadId)?.ctx ?? entry!.ctx });
    pool.set(threadId, entry);
    const e = entry;
    chat["~registerStatusCallback"](() => e.ctx.onStatus(chat.status));
  }
  entry.ctx = ctx;
  return entry;
}

export function mountChat(threadId: string) {
  const entry = pool.get(threadId);
  if (entry) entry.mounted += 1;
  return () => {
    const current = pool.get(threadId);
    if (!current) return;
    current.mounted = Math.max(0, current.mounted - 1);
    if (current.mounted === 0 && !isBusy(current.chat)) pool.delete(threadId);
  };
}

export function chatIsRunning(threadId: string) {
  const entry = pool.get(threadId);
  return !!entry && isBusy(entry.chat);
}
