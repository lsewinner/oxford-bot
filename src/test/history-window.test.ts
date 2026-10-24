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
    expect(out[0]?.role).toBe('user');
    expect(out.at(-1)!.id).toBe('39');
  });
  it('strips non-text parts from older turns', () => {
    const out = trimHistory(Array.from({ length: 6 }, (_, i) => msg(i)));
    expect(out[1]!.parts.every(p => p.type === 'text')).toBe(true);
  });
  it('only forces reasoning in Deep Think', () => {
    expect('forceReasoning' in thinkOptions(false)).toBe(false);
    expect(thinkOptions(true).forceReasoning).toBe(true);
  });
  it('normal questions allow 6 steps so lookup chains reach the write', () => { expect(workflowStepLimit('你好')).toBe(6); });
});

describe('unfinished tool calls', () => {
  it('drops tool parts without a result from recent turns', () => {
    const out = trimHistory([
      { id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { id: 'a', role: 'assistant', parts: [{ type: 'text', text: 'ok' }, { type: 'tool-demo_x', toolCallId: 't', state: 'input-available', input: {} } as never, { type: 'tool-demo_y', toolCallId: 'd', state: 'output-available', input: {}, output: {} } as never] },
    ]);
    expect(out[1]!.parts.map(p => p.type)).toEqual(['text', 'tool-demo_y']);
  });
});
