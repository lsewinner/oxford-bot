import type { UIMessage } from 'ai';
import { z } from 'zod';

export const sharedMessageSchema = z.object({
  id: z.string(), role: z.enum(['user', 'assistant']), text: z.string(),
  images: z.array(z.object({ url: z.string(), prompt: z.string() })),
  sources: z.array(z.object({ url: z.string(), title: z.string() })),
});
export type SharedMessage = z.infer<typeof sharedMessageSchema>;
export function publicSnapshot(messages: UIMessage[]): SharedMessage[] {
  return messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
    id: m.id, role: m.role as 'user' | 'assistant',
    text: m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n'),
    images: m.parts.flatMap(p => {
      if (p.type !== 'tool-generate_image' || !('output' in p)) return [];
      const output = p.output as { image?: unknown; prompt?: unknown } | undefined;
      return typeof output?.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(output.image)
        ? [{ url: output.image, prompt: typeof output.prompt === 'string' ? output.prompt : '' }] : [];
    }),
    sources: m.parts.flatMap(p => p.type === 'source-url' && /^https?:\/\//.test(p.url) ? [{ url: p.url, title: p.title ?? p.url }] : []),
  })).filter(m => m.text || m.images.length);
}
export function exportConversation(messages: UIMessage[], format: 'markdown' | 'text', title = 'Oxford Bot 对话') {
  const markdown = format === 'markdown';
  return `${markdown ? '# ' : ''}${title}\n\n` + publicSnapshot(messages).map(m => {
    const label = m.role === 'user' ? '我' : 'Oxford Bot';
    const images = m.images.map((image, i) => markdown ? `![生成图片 ${i + 1}](${image.url})\n\n提示词：${image.prompt}` : `[生成图片 ${i + 1}] 提示词：${image.prompt}`).join('\n\n');
    const sources = m.sources.map(s => markdown ? `- [${s.title}](${s.url})` : `${s.title}: ${s.url}`).join('\n');
    return `${markdown ? '## ' : ''}${label}\n\n${[m.text, images, sources].filter(Boolean).join('\n\n')}`;
  }).join('\n\n');
}
export function downloadConversation(messages: UIMessage[], format: 'markdown' | 'text') {
  const url = URL.createObjectURL(new Blob([exportConversation(messages, format)], { type: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `Oxford-Bot-${new Date().toISOString().slice(0, 10)}.${format === 'markdown' ? 'md' : 'txt'}`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}