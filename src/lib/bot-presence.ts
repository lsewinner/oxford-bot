import type { UIMessage } from "ai";
import { isCatBreed, type BotKind, type CatBreed } from "./cat-breeds";
export type { CatBreed, BotKind } from "./cat-breeds";

export type BotIdentity = { name: string; kind: BotKind; breed?: CatBreed };
export type BotEntry = { id: string; threadId: string; messageId: string; bot: BotIdentity; conversationId?: string };
export type BotActivity = { bot: BotIdentity | null; status: "ready" | "submitted" | "streaming" | "error" };

// Presentation only: recognizing a request does not create or connect an automation.
export function botFromRequest(text: string): BotIdentity | null {
  if (!/(bot|机器人|智能体|助手)/i.test(text) || !/(建|创建|做|搭|设|生成|create|build|make)/i.test(text)) return null;
  const custom = text.match(/(?:叫做|名叫|命名为|名字是|named)\s*[“"「]?([^”"」\n，。,:：]{1,24})/i)?.[1]?.trim();
  if (/(邮件|邮箱|gmail|outlook|email)/i.test(text)) return { name: custom || "邮件 Bot", kind: "mail" };
  if (/(文档|云盘|drive|文件)/i.test(text)) return { name: custom || "文档 Bot", kind: "document" };
  if (/(网站|网页|建站|website|web\s*site)/i.test(text)) return { name: custom || "建站 Bot", kind: "code" };
  if (/(github|代码|编程|程序|开发|运维|cloudflare|issue|pr\b|coding|code)/i.test(text)) return { name: custom || "开发 Bot", kind: "code" };
  if (/(slack|teams|频道|协作|简报)/i.test(text)) return { name: custom || "协作 Bot", kind: "team" };
  return { name: custom || "任务 Bot", kind: "general" };
}

export function botFromMessages(messages: UIMessage[]): BotIdentity | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const bot = botFromRequest(message.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"));
    if (bot) return bot;
  }
  return null;
}

export function botsFromMessages(threadId: string, messages: UIMessage[]): BotEntry[] {
  return messages.flatMap((message) => {
    if (message.role !== "user") return [];
    const bot = botFromRequest(message.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"));
    return bot ? [{ id: `${threadId}:${message.id}`, threadId, messageId: message.id, bot }] : [];
  });
}

export function mergeBotEntries(previous: BotEntry[], incoming: BotEntry[]): BotEntry[] {
  const known = new Set(previous.map((entry) => entry.id));
  return [...previous, ...incoming.filter((entry) => {
    if (known.has(entry.id)) return false;
    known.add(entry.id);
    return true;
  })];
}

export const botStorageKey = (scope: string) => `oxford:bots:v1:${scope}`;
// App was renamed from "Nightwave AI Chat" to "Oxford Bot"; stored entries keep working under the new name.
export const legacyAppNamePattern = /nightwave\s*(ai)?\s*chat/i;
export function normalizeBotName(name: string): string {
  return legacyAppNamePattern.test(name) ? "Oxford Bot" : name;
}
export function parseBotEntries(raw: string | null): BotEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const breeds = ["mail", "document", "code", "team", "general"];
    return parsed.filter((entry): entry is BotEntry => entry && typeof entry.id === "string" && typeof entry.threadId === "string" && typeof entry.messageId === "string" && typeof entry.bot?.name === "string" && breeds.includes(entry.bot.kind) && (entry.bot.breed === undefined || isCatBreed(entry.bot.breed)) && (entry.conversationId === undefined || typeof entry.conversationId === "string"))
      .map((entry) => ({ ...entry, bot: { ...entry.bot, name: normalizeBotName(entry.bot.name) } }));
  } catch { return []; }
}

export function botIsWorking(status: BotActivity["status"]): boolean {
  return status === "submitted" || status === "streaming";
}