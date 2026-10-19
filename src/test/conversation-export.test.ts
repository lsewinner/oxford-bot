import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { exportConversation, publicSnapshot } from '@/lib/conversation-export';
const messages: UIMessage[] = [
  { id: 'u', role: 'user', parts: [{ type: 'text', text: '画一只猫' }, { type: 'file', mediaType: 'application/pdf', url: 'data:application/pdf;base64,private' }] },
  { id: 'a', role: 'assistant', parts: [
    { type: 'text', text: '完成了\n```js\nconst cat = 1;\n```' },
    { type: 'reasoning', text: 'private reasoning' },
    { type: 'tool-generate_image', toolCallId: 'img', state: 'output-available', input: { prompt: '猫' }, output: { prompt: '猫', image: 'data:image/png;base64,YQ==' } },
    { type: 'source-url', sourceId: 's', url: 'https://example.com', title: '参考' },
    { type: 'tool-service_gmail', toolCallId: 'mail', state: 'output-available', input: {}, output: { secret: 'private account' } },
  ] },
];
describe('conversation exports and shares', () => {
  it('exports all messages to Markdown with code and generated images', () => {
    const result = exportConversation(messages, 'markdown');
    expect(result).toContain('## 我\n\n画一只猫');
    expect(result).toContain('```js\nconst cat = 1;\n```');
    expect(result).toContain('![生成图片 1](data:image/png;base64,YQ==)');
  });
  it('exports plain text and source URLs', () => {
    const result = exportConversation(messages, 'text');
    expect(result).toContain('我\n\n画一只猫');
    expect(result).toContain('参考: https://example.com');
    expect(result).not.toContain('## 我');
  });
  it('never shares attachments, reasoning or service tool outputs', () => {
    const result = JSON.stringify(publicSnapshot(messages));
    expect(result).not.toContain('private');
    expect(publicSnapshot(messages)[1]?.images[0]?.prompt).toBe('猫');
  });
});