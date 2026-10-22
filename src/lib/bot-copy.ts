import { isCatBreed, type BotKind } from "./cat-breeds";
import type { BotIdentity } from "./bot-presence";

const KEY = "oxford:pending-bot-copy:v1";
const KINDS: BotKind[] = ["general", "mail", "document", "code", "team"];

export function shareToIdentity(shared: { name: string; kind: string; breed: string | null; systemPrompt?: string }): BotIdentity {
  const kind = (KINDS as string[]).includes(shared.kind) ? (shared.kind as BotKind) : "general";
  return {
    name: shared.name.slice(0, 40),
    kind,
    ...(shared.breed && isCatBreed(shared.breed) ? { breed: shared.breed } : {}),
    ...(shared.systemPrompt ? { systemPrompt: shared.systemPrompt.slice(0, 8000) } : {}),
  };
}

export function queueBotCopy(bot: BotIdentity) {
  sessionStorage.setItem(KEY, JSON.stringify(bot));
}

/** Claims the pending copy exactly once: removal happens before the caller creates the Bot. */
export function takeBotCopy(): BotIdentity | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const v = JSON.parse(raw) as { name?: unknown; kind?: unknown; breed?: unknown; systemPrompt?: unknown };
    if (typeof v.name !== "string" || !v.name.trim() || typeof v.kind !== "string") return null;
    return shareToIdentity({ name: v.name, kind: v.kind, breed: typeof v.breed === "string" ? v.breed : null, ...(typeof v.systemPrompt === "string" ? { systemPrompt: v.systemPrompt } : {}) });
  } catch { return null; }
}
