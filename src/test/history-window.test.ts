import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import { trimHistory } from '@/lib/ai/history-window';
import { thinkOptions } from '@/lib/bot-config';
import { workflowStepLimit } from '@/lib/workflows';

const msg = (i: number): UIMessage => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', parts: [{ type: 'text', text: `m${i}` }, ...(i % 2 ? [{ type: 'source-url', sourceId: 's', url: 'https://x.com' } as never] : [])] });

describe('cost controls', () => {
  it('keeps at most 16 messages starting with a user turn', () => {
    const out = trimHistory(Array.from({ length: 40 }, (_, i) => msg(i)));
    expect(out.length).toBeLessThanOrEqual(16);
    expect(out[0].role).toBe('user');
    expect(out.at(-1)!.id).toBe('39');
  });
  it('strips non-text parts from older turns', () => {
    const out = trimHistory(Array.from({ length: 6 }, (_, i) => msg(i)));
    expect(out[1].parts.every(p => p.type === 'text')).toBe(true);
  });
  it('only forces reasoning in Deep Think', () => {
    expect('forceReasoning' in thinkOptions(false)).toBe(false);
    expect(thinkOptions(true).forceReasoning).toBe(true);
  });
  it('normal questions use at most 3 tool steps', () => { expect(workflowStepLimit('你好')).toBe(3); });
});
