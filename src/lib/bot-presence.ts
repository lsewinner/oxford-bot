import type { UIMessage } from "ai";
import { isCatBreed, type BotKind, type CatBreed } from "./cat-breeds";
import { allowedToolIds } from './tool-catalog';
import type { ProviderId } from './connections/catalog';
export type { CatBreed, BotKind } from "./cat-breeds";

export type BotIdentity = { name: string; kind: BotKind; breed?: CatBreed; systemPrompt?:string; preferredTools?:ProviderId[] };
export type BotEntry = { id: string; threadId: string; messageId: string; bot: BotIdentity; conversationId?: string; hidden?: true; overrides?: { name: string; breed?: CatBreed } };
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
  const merged = new Map(previous.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const existing = merged.get(entry.id);
    const overrides = existing?.overrides ?? entry.overrides;
    const conversationId = existing?.conversationId ?? entry.conversationId;
    merged.set(entry.id, { ...entry, ...existing, bot: { ...(existing?.bot ?? entry.bot), ...overrides },
      ...(overrides ? { overrides } : {}), ...(conversationId ? { conversationId } : {}) });
  }
  return [...merged.values()];
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
      .map((entry) => {
        const overrides = entry.overrides && typeof entry.overrides.name === "string" && (entry.overrides.breed === undefined || isCatBreed(entry.overrides.breed))
          ? { name: normalizeBotName(entry.overrides.name), ...(entry.overrides.breed ? { breed: entry.overrides.breed } : {}) } : undefined;
        const { overrides: ignored, ...base } = entry;
        return { ...base, ...(overrides ? { overrides } : {}), bot: { ...entry.bot, ...(typeof entry.bot.systemPrompt==='string'?{systemPrompt:entry.bot.systemPrompt.slice(0,8000)}:{}), ...(Array.isArray(entry.bot.preferredTools)?{preferredTools:allowedToolIds(entry.bot.preferredTools)}:{}), name: normalizeBotName(entry.bot.name), ...overrides } };
      });
  } catch { return []; }
}

export function botIsWorking(status: BotActivity["status"]): boolean {
  return status === "submitted" || status === "streaming";
}