import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { thinkOptions } from '@/lib/bot-config';
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from './run-id';

export type ChatProviderSecrets = {
  OPENAI_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  LOVABLE_API_KEY?: string | undefined;
};

/** Selection is configuration-only: failures never trigger a billed fallback. */
export function selectChatProvider(secrets: ChatProviderSecrets) {
  const openai = secrets.OPENAI_API_KEY?.trim();
  if (openai) return { kind: 'openai' as const, apiKey: openai };
  const anthropic = secrets.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return { kind: 'anthropic' as const, apiKey: anthropic };
  const gateway = secrets.LOVABLE_API_KEY?.trim();
  if (gateway) return { kind: 'gateway' as const, apiKey: gateway };
  return null;
}

export function createChatProvider(request: Request, secrets: ChatProviderSecrets, deepThink: boolean) {
  const selected = selectChatProvider(secrets);
  if (!selected) return null;
  if (selected.kind === 'anthropic') {
    const provider = createAnthropic({ apiKey: selected.apiKey, baseURL: 'https://api.anthropic.com/v1' });
    return {
      kind: selected.kind,
      model: provider('claude-sonnet-4-6'),
      webSearch: () => provider.tools.webSearch_20260209(),
      providerOptions: { anthropic: { thinking: { type: 'adaptive' as const }, effort: deepThink ? 'high' as const : 'low' as const } },
      wrapResponse: (response: Response) => response,
    };
  }
  if (selected.kind === 'openai') {
    const provider = createOpenAI({ apiKey: selected.apiKey, baseURL: 'https://api.openai.com/v1' });
    return {
      kind: selected.kind,
      model: provider.responses('gpt-5.6'),
      webSearch: () => provider.tools.webSearch(),
      providerOptions: { openai: thinkOptions(deepThink) },
      wrapResponse: (response: Response) => response,
    };
  }
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1', apiKey: selected.apiKey,
    headers: { 'Lovable-API-Key': selected.apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: runIdFetch.fetch,
  });
  return {
    kind: selected.kind,
    model: provider.responses('openai/gpt-6-astra'),
    webSearch: () => provider.tools.webSearch(),
    providerOptions: { openai: thinkOptions(deepThink) },
    wrapResponse: (response: Response) => withLovableAiGatewayRunIdHeader(response, runIdFetch),
  };
}