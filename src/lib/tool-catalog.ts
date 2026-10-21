export const TOOL_CATALOG = [
  { id: "google_mail", name: "Gmail", category: "邮件助手", detail: "邮件检索 · 摘要 · 起草", action: "检索邮件并起草回复" },
  { id: "microsoft_outlook", name: "Outlook", category: "邮件助手", detail: "邮件检索 · 摘要 · 起草", action: "检索邮件并起草回复" },
  { id: "notion", name: "Notion", category: "云盘与文档", detail: "页面 · 数据库 · 写入笔记", action: "检索并整理 Notion 内容" },
  { id: "yuque", name: "语雀", category: "云盘与文档", detail: "知识库 · 文档 · 新建与更新", action: "查询知识库并整理文档" },
  { id: "google_drive", name: "Google Drive", category: "云盘与文档", detail: "文档检索 · 文件解析", action: "检索并解析文档" },
  { id: "github", name: "GitHub", category: "开发与运维", detail: "代码库 · Issue · PR", action: "查询代码库、Issue 和 PR" },
  { id: "cloudflare", name: "Cloudflare", category: "开发与运维", detail: "DNS · 站点管理", action: "查询 DNS 与站点状态" },
  { id: "supabase", name: "Supabase", category: "开发与运维", detail: "项目 · 表结构 · 只读查询 · 健康检查", action: "查询数据库结构与数据" },
  { id: "slack", name: "Slack", category: "即时协作", detail: "频道消息 · 工作简报", action: "检索频道并整理简报" },
  { id: "microsoft_teams", name: "Teams", category: "即时协作", detail: "频道消息 · 工作简报", action: "检索频道并整理简报" },
] as const;
export type ToolId = typeof TOOL_CATALOG[number]["id"];

export function allowedToolIds(value: unknown): ToolId[] {
  if (!Array.isArray(value)) return [];
  return TOOL_CATALOG.filter((tool) => value.includes(tool.id)).map((tool) => tool.id);
}

export function simulateTool(id: ToolId, query: string) {
  const tool = TOOL_CATALOG.find((item) => item.id === id);
  return {
    mode: "simulation" as const,
    provider: tool?.name ?? id,
    query,
    status: "completed" as const,
    summary: `模拟：${tool?.action}。未连接真实账户，未读取或更改任何外部数据。`,
    sample: id === "google_drive" ? "示例文档：项目计划（演示数据）"
      : id === "github" ? "示例 Issue：完善登录流程（演示数据）"
      : id === "notion" ? "示例页面：项目周报（演示数据）"
      : id === "yuque" ? "示例文档：知识库周报（演示数据）"
      : id === "supabase" ? "示例项目：表结构查询已完成（演示数据）"
      : id === "cloudflare" ? "示例站点：DNS 查询流程已完成（演示数据）"
      : id === "slack" || id === "microsoft_teams" ? "示例简报：团队正在准备本周发布（演示数据）"
      : "示例草稿：感谢来信，我们会尽快确认安排。（仅演示，未保存或发送）",
  };
}