import { isCatBreed, type BotKind } from "./cat-breeds";
import type { BotIdentity } from "./bot-presence";

const KEY = "oxford:pending-bot-copy:v1";
const KINDS: BotKind[] = ["general", "mail", "document", "code", "team"];
const MAX_TRIAL = 40;

export type TrialMessage = { role: "user" | "assistant"; text: string };

export function shareToIdentity(shared: { name: string; kind: string; breed: string | null; systemPrompt?: string }): BotIdentity {
  const kind = (KINDS as string[]).includes(shared.kind) ? (shared.kind as BotKind) : "general";
  return {
    name: shared.name.slice(0, 40),
    kind,
    ...(shared.breed && isCatBreed(shared.breed) ? { breed: shared.breed } : {}),
    ...(shared.systemPrompt ? { systemPrompt: shared.systemPrompt.slice(0, 8000) } : {}),
  };
}

/** Keeps only text from trial messages so the copied Bot starts with the conversation, never tool actions or files. */
export function trialFromMessages(messages: unknown[]): TrialMessage[] {
  const out: TrialMessage[] = [];
  for (const m of messages) {
    const msg = m as { role?: unknown; parts?: unknown };
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const text = Array.isArray(msg.parts)
      ? msg.parts.filter((p: { type?: unknown; text?: unknown }) => p?.type === "text" && typeof p.text === "string").map((p: { text: string }) => p.text).join("\n").trim()
      : "";
    if (text) out.push({ role: msg.role, text: text.slice(0, 8000) });
  }
  return out.slice(-MAX_TRIAL);
}

export function queueBotCopy(bot: BotIdentity, trial: TrialMessage[] = []) {
  sessionStorage.setItem(KEY, JSON.stringify({ ...bot, trial }));
}

/** Claims the pending copy exactly once: removal happens before the caller creates the Bot. */
export function takeBotCopy(): (BotIdentity & { trial: TrialMessage[] }) | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const v = JSON.parse(raw) as { name?: unknown; kind?: unknown; breed?: unknown; systemPrompt?: unknown; trial?: unknown };
    if (typeof v.name !== "string" || !v.name.trim() || typeof v.kind !== "string") return null;
    const bot = shareToIdentity({ name: v.name, kind: v.kind, breed: typeof v.breed === "string" ? v.breed : null, ...(typeof v.systemPrompt === "string" ? { systemPrompt: v.systemPrompt } : {}) });
    const trial = Array.isArray(v.trial) ? trialFromMessages(v.trial.map((t: { role?: unknown; text?: unknown }) => ({ role: t?.role, parts: [{ type: "text", text: t?.text }] }))) : [];
    return { ...bot, trial };
  } catch { return null; }
}
