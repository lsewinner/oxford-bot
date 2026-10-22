import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { thinkOptions } from '@/lib/bot-config';
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from './run-id';

export type ChatProviderSecrets = {
  OPENAI_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  LOVABLE_API_KEY?: string | undefined;
  OPENAI_MODEL?: string | undefined;
  DASHSCOPE_API_KEY?: string | undefined;
  DASHSCOPE_MODEL?: string | undefined;
};

/** Only an explicit region/territory refusal counts; auth, quota and outages never switch providers. */
export function isRegionBlocked(error: unknown): boolean {
  const e = error as { statusCode?: number; responseBody?: string; message?: string } | null;
  if (!e || (e.statusCode !== undefined && e.statusCode !== 403)) return false;
  return /unsupported_country|country, region,? or territory|provider_not_available_in_region|not available in your (country|region)/i.test(`${e.responseBody ?? ''} ${e.message ?? ''}`);
}

export const DOMESTIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/** Domestic (Qwen) model used only after a confirmed region refusal from the primary model. */
function createDomesticModel(secrets: ChatProviderSecrets) {
  const key = secrets.DASHSCOPE_API_KEY?.trim();
  if (!key) return null;
  return createOpenAI({ name: 'dashscope', apiKey: key, baseURL: DOMESTIC_BASE_URL }).chat(secrets.DASHSCOPE_MODEL?.trim() || 'qwen-plus');
}

type AnyModel = Record<string, any>;
export function withRegionFallback<T extends object>(primary: T, fallback: AnyModel | null): T {
  if (!fallback) return primary;
  return new Proxy(primary, {
    get(target, prop, receiver) {
      if (prop === 'doStream' || prop === 'doGenerate') {
        return async (options: AnyModel) => {
          try { return await (target as AnyModel)[prop](options); }
          catch (error) {
            if (!isRegionBlocked(error)) throw error;
            console.warn('primary model region-blocked; using domestic model');
            const { openai: _o, ...providerOptions } = options['providerOptions'] ?? {};
            const tools = Array.isArray(options['tools']) ? options['tools'].filter((t: AnyModel) => t['type'] === 'function') : undefined;
            return fallback[prop]({ ...options, providerOptions, ...(tools ? { tools } : {}) });
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

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
      model: withRegionFallback(provider('claude-sonnet-4-6'), createDomesticModel(secrets)),
      webSearch: () => provider.tools.webSearch_20260209(),
      providerOptions: { anthropic: { sendReasoning: false, thinking: { type: 'adaptive' as const }, effort: deepThink ? 'high' as const : 'low' as const } },
      wrapResponse: (response: Response) => response,
    };
  }
  if (selected.kind === 'openai') {
    const provider = createOpenAI({ apiKey: selected.apiKey, baseURL: 'https://api.openai.com/v1' });
    return {
      kind: selected.kind,
      model: withRegionFallback(provider.responses(secrets.OPENAI_MODEL?.trim() || 'gpt-6-sol'), createDomesticModel(secrets)),
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
    model: withRegionFallback(provider.responses('openai/gpt-6-sol'), createDomesticModel(secrets)),
    webSearch: () => provider.tools.webSearch(),
    providerOptions: { openai: thinkOptions(deepThink) },
    wrapResponse: (response: Response) => withLovableAiGatewayRunIdHeader(response, runIdFetch),
  };
}