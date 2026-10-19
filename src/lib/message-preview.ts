import type { UIMessage } from "ai";

/** One-line preview of the latest message, like the snippet shown under each Bot in the sidebar. */
export function messagePreview(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  for (const part of last.parts ?? []) {
    if (part.type === "text" && part.text.trim()) return part.text.trim();
  }
  const hasMedia = (last.parts ?? []).some((part) => {
    const type = (part as { type?: string }).type ?? "";
    return type === "file" || type === "image" || type.startsWith("tool-");
  });
  return hasMedia ? "[图片/文件]" : "";
}
