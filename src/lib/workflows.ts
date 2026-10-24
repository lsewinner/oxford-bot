import { z } from 'zod';
import { PROVIDERS, providerId, type ProviderId } from './connections/catalog';

export const WORKFLOWS = [
  { id: 'weekly', name: '工作周报', icon: 'report', steps: ['汇集任务与动态', '整理进展与风险', '生成周报'], providers: ['jira', 'asana', 'clickup', 'linear', 'github', 'gitee', 'google_mail', 'microsoft_outlook', 'slack', 'telegram', 'notion', 'yuque', 'google_drive', 'airtable'] },
  { id: 'meeting', name: '会议准备', icon: 'calendar', steps: ['查看日程', '检索邮件与资料', '整理议程与待办'], providers: ['google_calendar', 'microsoft_calendar', 'google_mail', 'microsoft_outlook', 'google_drive', 'notion', 'yuque', 'jira', 'asana', 'slack'] },
  { id: 'transfer', name: '跨工具整理', icon: 'transfer', steps: ['读取来源内容', '整理目标内容', '提交待确认操作'], providers: ['google_mail', 'microsoft_outlook', 'slack', 'telegram', 'google_drive', 'notion', 'yuque', 'github', 'gitee', 'jira', 'asana', 'clickup', 'linear', 'airtable'] },
] as const;
export type WorkflowId = typeof WORKFLOWS[number]['id'];
export const workflowAccountSchema = z.object({ provider: providerId, account: z.string().max(320), label: z.string().max(320) }).strict();
export type WorkflowAccount = z.infer<typeof workflowAccountSchema>;
export const workflowRequestSchema = z.object({
  id: z.enum(['weekly', 'meeting', 'transfer']),
  sources: z.array(workflowAccountSchema).min(1).max(4),
  destination: workflowAccountSchema.nullable(),
  details: z.string().trim().max(2000),
  period: z.enum(['week', 'fortnight', 'month']),
}).strict().superRefine((v, ctx) => {
  if (v.id === 'transfer' && (!v.destination || !v.details)) ctx.addIssue({ code: 'custom', message: '请选择目标账户并填写整理目标' });
  if (v.id === 'meeting' && !v.details) ctx.addIssue({ code: 'custom', message: '请填写会议名称或时间' });
  if (v.destination && !canReceiveWorkflow(v.destination.provider)) ctx.addIssue({ code: 'custom', message: '此工具暂不支持保存或发送' });
  if (new Set(v.sources.map(accountKey)).size !== v.sources.length) ctx.addIssue({ code: 'custom', message: '来源账户不能重复' });
});
export type WorkflowRequest = z.infer<typeof workflowRequestSchema>;
export function accountKey(a: WorkflowAccount) { return `${a.provider}:${a.account}`; }
export function canReceiveWorkflow(id: ProviderId) { return ['google_mail', 'microsoft_outlook', 'slack', 'telegram', 'google_drive', 'notion', 'yuque', 'github', 'gitee', 'jira', 'asana', 'clickup', 'linear', 'airtable'].includes(id); }

const PREFIX = '[Oxford 工作流 · ';
export function isWorkflowPrompt(text: string) { return WORKFLOWS.some(w => text.startsWith(`${PREFIX}${w.name}]\n`)); }
export function workflowStepLimit(text: string) { return isWorkflowPrompt(text) ? 12 : 6; }

export function buildWorkflowPrompt(raw: WorkflowRequest, now = new Date(), timeZone = 'Asia/Shanghai') {
  const input = workflowRequestSchema.parse(raw);
  const workflow = WORKFLOWS.find(w => w.id === input.id);
  if (!workflow) throw new Error('工作流不存在');
  const days = input.period === 'month' ? 30 : input.period === 'fortnight' ? 14 : 7;
  const describe = (a: WorkflowAccount) => `${PROVIDERS[a.provider].name} · ${a.label || a.account || '默认账户'}（service_${a.provider}，account=${JSON.stringify(a.account)}）`;
  const start = new Date(now.getTime() - days * 86400000).toISOString();
  return `${PREFIX}${workflow.name}]\n请在当前 Bot 对话中完成${workflow.name}。\n当前时间：${now.toISOString()}；用户时区：${timeZone}。\n${input.id === 'weekly' ? `报告范围：最近 ${days} 天，${start} 至 ${now.toISOString()}。` : ''}\n来源账户：\n${input.sources.map(a => `- ${describe(a)}`).join('\n')}\n目标：${input.destination ? describe(input.destination) : '只在当前对话生成结果，不向外部保存或发送'}。\n补充要求：${input.details || '按项目整理完成事项、进行中事项、风险与下一步；没有完成或日期证据的事项不得推断为本期完成。'}\n执行顺序：${workflow.steps.join(' → ')}。\n先简短列出执行计划，再依次读取所选来源的真实数据；只使用上述来源及目标账户，不使用模拟工具。资源 ID 必须来自实际查询；有多个项目、频道、页面、收件人或目标列表时先询问我，不得猜测。搜索列表不是全文，有必要时继续读取正文。来源失败应明确标注并继续可用来源，不把空结果当作失败，不编造缺失数据。汇总保留来源标题、标识或链接，注明时间范围与截断限制。${input.id === 'meeting' ? '根据会议名称及时间匹配真实日程，整理背景资料、议程、关键问题与行动建议；多场匹配先让我选择。' : ''}${input.destination ? '先预览完整的目标内容，确认目标位置后只提交待确认操作；等待我在操作卡片确认，禁止声称已保存或已发送，禁止把我的本次发起当作写入批准。' : '只输出汇总，不调用任何写入操作。'}\n如果本轮工具步骤不足，清楚列出已完成部分与剩余步骤，让我继续；不得假装流程全部完成。`;
}

export const WORKFLOW_INSTRUCTIONS = ' 当前为多工具工作流。先简述计划，分阶段获取真实资源与正文，汇总时注明来源和覆盖范围。只按用户选定账户调用，缺失必要目标信息时询问，不猜测 ID。一次最多并行 4 个独立读取，依赖上一步结果的调用必须等待结果。不要重复提交相同写入提案，confirmation_required 是暂停等待用户确认而非完成；确认后的结果来自持久化操作卡片，失败或取消不得当作成功，依赖该写入的下一步必须等 completed。步骤用尽时明确剩余任务，不宣称全部完成。';