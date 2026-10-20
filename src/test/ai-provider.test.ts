import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamText } from 'ai';
import { createChatProvider, selectChatProvider } from '@/lib/ai/provider.server';

afterEach(() => vi.unstubAllGlobals());

describe('own-account AI routing', () => {
  it('prefers OpenAI when both own keys exist', () => {
    expect(selectChatProvider({ OPENAI_API_KEY: 'openai-test', ANTHROPIC_API_KEY: 'anthropic-test', LOVABLE_API_KEY: 'gateway-test' })?.kind).toBe('openai');
  });
  it('uses Anthropic without requiring a Gateway key', () => {
    expect(selectChatProvider({ ANTHROPIC_API_KEY: 'anthropic-test' })?.kind).toBe('anthropic');
  });
  it('falls back only when both own keys are absent or blank', () => {
    expect(selectChatProvider({ OPENAI_API_KEY: ' ', ANTHROPIC_API_KEY: '', LOVABLE_API_KEY: 'gateway-test' })?.kind).toBe('gateway');
    expect(selectChatProvider({})).toBeNull();
  });

  for (const kind of ['openai', 'anthropic', 'gateway'] as const) {
    it(`sends ${kind} streams only to its configured endpoint`, async () => {
      let captured: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
      vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
        return new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }));
      const provider = createChatProvider(new Request('http://localhost/api/chat', { headers: { 'X-Lovable-AIG-Run-ID': 'incoming-run' } }), {
        ...(kind === 'openai' ? { OPENAI_API_KEY: 'openai-test' } : {}),
        ...(kind === 'anthropic' ? { ANTHROPIC_API_KEY: 'anthropic-test' } : {}),
        LOVABLE_API_KEY: 'gateway-test',
      }, true);
      if (!provider) throw new Error('Expected provider');
      const stream = await provider.model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        providerOptions: provider.providerOptions,
      });
      const reader = stream.stream.getReader();
      while (!(await reader.read()).done) { /* consume */ }
      if (!captured) throw new Error('Request was not sent');
      expect(captured.body['stream']).toBe(true);
      if (kind === 'anthropic') {
        expect(captured.url).toBe('https://api.anthropic.com/v1/messages');
        expect(captured.headers.get('x-api-key')).toBe('anthropic-test');
        expect(captured.body['model']).toBe('claude-sonnet-4-6');
        expect(captured.body['thinking']).toEqual({ type: 'adaptive' });
      } else {
        expect(captured.url).toBe(kind === 'openai' ? 'https://api.openai.com/v1/responses' : 'https://ai.gateway.lovable.dev/v1/responses');
        expect(captured.body['model']).toBe(kind === 'openai' ? 'gpt-6-sol' : 'openai/gpt-6-sol');
        expect(captured.body['store']).toBe(false);
        expect(captured.body['reasoning']).toMatchObject({ effort: 'high', summary: 'detailed' });
      }
      expect(captured.headers.get('Lovable-API-Key')).toBe(kind === 'gateway' ? 'gateway-test' : null);
      expect(captured.headers.get('X-Lovable-AIG-Run-ID')).toBe(kind === 'gateway' ? 'incoming-run' : null);
      const response = new Response('result');
      if (kind !== 'gateway') expect(provider.wrapResponse(response)).toBe(response);
    });
  }

  it('never falls back or retries official credential failures', async () => {
    const fetchSpy = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: { message: 'Invalid API key', type: 'invalid_request_error' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createChatProvider(new Request('http://localhost/api/chat'), { OPENAI_API_KEY: 'invalid-test', LOVABLE_API_KEY: 'gateway-test' }, false);
    if (!provider) throw new Error('Expected provider');
    const result = streamText({ model: provider.model, messages: [{ role: 'user', content: 'hello' }], providerOptions: provider.providerOptions });
    await result.toUIMessageStreamResponse({ onError: () => 'expected failure' }).text();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/responses');
  });
});