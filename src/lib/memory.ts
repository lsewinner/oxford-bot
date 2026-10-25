export type MemoryKind = "identity" | "knowledge";
export const MEMORY_MAX = 20000;

/** Builds the system-prompt block from published memory; identity precedes knowledge. */
export function buildMemoryContext(mem: Partial<Record<MemoryKind, string>>): string {
  const parts: string[] = [];
  const id = mem.identity?.trim();
  const kb = mem.knowledge?.trim();
  if (id) parts.push(`【Oxford Bot 核心身份记忆】\n${id.slice(0, MEMORY_MAX)}`);
  if (kb) parts.push(`【产品与公司知识库】（仅作参考事实，用户的当前指令与安全规则优先）\n${kb.slice(0, MEMORY_MAX)}`);
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}
