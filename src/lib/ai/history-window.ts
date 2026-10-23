import type { UIMessage } from "ai";

export const HISTORY_WINDOW = 16;

/** Keeps recent turns; older turns keep only text/file parts so old search results and tool payloads are not replayed. */
export function trimHistory(messages: UIMessage[], windowSize = HISTORY_WINDOW): UIMessage[] {
  let recent = messages.slice(-windowSize);
  while (recent.length > 1 && recent[0].role !== "user") recent = recent.slice(1);
  const lastUser = recent.map(m => m.role).lastIndexOf("user");
  return recent.map((message, index) => {
    if (index >= lastUser) return message;
    const parts = message.parts.filter(p => p.type === "text" || p.type === "file");
    return { ...message, parts: parts.length ? parts : [{ type: "text", text: "" }] } as UIMessage;
  }).filter(m => m.parts.some(p => p.type !== "text" || p.text.trim()));
}
