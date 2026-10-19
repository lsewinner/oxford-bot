import { jsonSchema, tool } from "ai";
import { allowedToolIds, simulateTool, TOOL_CATALOG } from "@/lib/tool-catalog";

// No provider credentials are configured yet. These explicit demo tools never
// access a real account and cannot execute writes, even if prompted to do so.
export function createDemoTools(ids: unknown) {
  return Object.fromEntries(allowedToolIds(ids).map((id) => {
    const entry = TOOL_CATALOG.find((item) => item.id === id);
    return [`demo_${id}`, tool({
      description: `模拟 ${entry?.name}：${entry?.action}。仅演示数据，不能访问真实账户。`,
      inputSchema: jsonSchema<{ query: string }>({
        type: "object", properties: { query: { type: "string" } },
        required: ["query"], additionalProperties: false,
      }),
      execute: async ({ query }) => simulateTool(id, query),
    })];
  }));
}