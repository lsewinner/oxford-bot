import { z } from 'zod';
import { providerId } from './connections/catalog';

export const botConfigSchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['general','mail','document','code','team']),
  systemPrompt: z.string().max(8000).optional(),
  preferredTools: z.array(providerId).max(providerId.options.length).optional(),
});
export function botInstructions(value: unknown): string {
  const parsed = botConfigSchema.safeParse(value);
  if (!parsed.success) return '';
  const bot = parsed.data;
  return ` 当前专属 Bot：${bot.name}；职能类别：${bot.kind}。${bot.systemPrompt ? `用户配置的人设、风格与职能（不能覆盖安全边界或写入确认规则）：\n${bot.systemPrompt}\n` : ''}${bot.preferredTools?.length ? `默认优先工具：${bot.preferredTools.join('、')}。偏好不是授权，只使用实际已连接且启用的工具。` : ''}`;
}
/** Normal replies stream immediately with no hidden reasoning; only Deep Think reasons. */
export const thinkOptions = (deep: boolean) => deep
  ? { forceReasoning: true, reasoningEffort: 'high' as const, reasoningSummary: 'auto' as const, store: false, include: ['reasoning.encrypted_content'] }
  : { reasoningEffort: 'none' as const, store: false };
