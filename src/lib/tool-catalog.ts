export const TOOL_CATALOG = [
  { id: "google_mail", name: "Gmail", category: "邮件助手", detail: "邮件检索 · 摘要 · 起草", action: "检索邮件并起草回复" },
  { id: "microsoft_outlook", name: "Outlook", category: "邮件助手", detail: "邮件检索 · 摘要 · 起草", action: "检索邮件并起草回复" },
  { id: "notion", name: "Notion", category: "云盘与文档", detail: "页面 · 数据库 · 写入笔记", action: "检索并整理 Notion 内容" },
  { id: "yuque", name: "语雀", category: "云盘与文档", detail: "知识库 · 文档 · 新建与更新", action: "查询知识库并整理文档" },
  { id: "google_calendar", name: "Google Calendar", category: "日程与会议", detail: "查看日程 · 创建日程", action: "查看并安排日程" },
  { id: "microsoft_calendar", name: "Outlook 日历", category: "日程与会议", detail: "查看日程 · 创建日程", action: "查看并安排日程" },
  { id: "google_drive", name: "Google 云盘", category: "云盘与文档", detail: "浏览文件夹 · 检索文件 · 读取正文", action: "浏览并读取云盘文件" },
  { id: "github", name: "GitHub", category: "开发与运维", detail: "代码库 · Issue · PR", action: "查询代码库、Issue 和 PR" },
  { id: "cloudflare", name: "Cloudflare", category: "开发与运维", detail: "DNS · 站点管理", action: "查询 DNS 与站点状态" },
  { id: "supabase", name: "Supabase", category: "开发与运维", detail: "项目 · 表结构 · 只读查询 · 健康检查", action: "查询数据库结构与数据" },
  { id: "gitee", name: "Gitee", category: "开发与运维", detail: "仓库 · Issue · 读取文件", action: "查询 Gitee 仓库与 Issue" },
  { id: "linear", name: "Linear", category: "开发与运维", detail: "团队 · 问题 · 评论", action: "查询并整理 Linear 问题" },
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
    sample: id === "google_calendar" || id === "microsoft_calendar" ? "示例日程：周三 14:00 产品评审（演示数据）"
      : id === "google_drive" ? "示例文档：项目计划（演示数据）"
      : id === "github" ? "示例 Issue：完善登录流程（演示数据）"
      : id === "notion" ? "示例页面：项目周报（演示数据）"
      : id === "yuque" ? "示例文档：知识库周报（演示数据）"
      : id === "supabase" ? "示例项目：表结构查询已完成（演示数据）"
      : id === "cloudflare" ? "示例站点：DNS 查询流程已完成（演示数据）"
      : id === "gitee" ? "示例 Issue：修复首页加载（演示数据）"
      : id === "linear" ? "示例问题：登录页在 Safari 下偶发报错（演示数据）"
      : id === "slack" || id === "microsoft_teams" ? "示例简报：团队正在准备本周发布（演示数据）"
      : "示例草稿：感谢来信，我们会尽快确认安排。（仅演示，未保存或发送）",
  };
}