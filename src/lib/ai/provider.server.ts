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
  DEEPSEEK_API_KEY?: string | undefined;
  DEEPSEEK_MODEL?: string | undefined;
};

/** Only an explicit region/territory refusal counts; auth, quota and outages never switch providers. */
export function isRegionBlocked(error: unknown): boolean {
  const e = error as { statusCode?: number; responseBody?: string; message?: string } | null;
  if (!e || (e.statusCode !== undefined && e.statusCode !== 403)) return false;
  return /unsupported_country|country, region,? or territory|provider_not_available_in_region|not available in your (country|region)/i.test(`${e.responseBody ?? ''} ${e.message ?? ''}`);
}

export const DOMESTIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export type DomesticChoice = { provider: 'dashscope' | 'deepseek'; stripTools: boolean };

/** Deep Think reasons on DeepSeek's reasoner when configured; quick answers stay on Qwen. */
export function selectDomesticModel(secrets: ChatProviderSecrets, deepThink: boolean): DomesticChoice | null {
  const deepseek = deepThink ? secrets.DEEPSEEK_API_KEY?.trim() : undefined;
  if (deepseek) return { provider: 'deepseek', stripTools: true };
  if (secrets.DASHSCOPE_API_KEY?.trim()) return { provider: 'dashscope', stripTools: false };
  return null;
}

export function needsLiveSearch(text: string): boolean {
  return /天气|气温|下雨|新闻|最新|今天|今日|明天|昨天|现在|实时|股价|汇率|比分|weather|news|today|latest|price/i.test(text);
}

export const withQwenSearch: typeof fetch = (input, init) => {
  if (typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      // Qwen skips search when tools are present, so time-sensitive questions force it.
      const last = [...(body.messages ?? [])].reverse().find((m: { role?: string }) => m.role === 'user');
      const text = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '');
      init = { ...init, body: JSON.stringify({ ...body, enable_search: true, ...(needsLiveSearch(text) ? { search_options: { forced_search: true } } : {}) }) };
    } catch { /* non-JSON body */ }
  }
  return fetch(input, init);
};

/** Domestic (Qwen/DeepSeek) model used only after a confirmed region refusal from the primary model. */
function createDomesticModel(secrets: ChatProviderSecrets, domestic: DomesticChoice) {
  if (domestic.provider === 'deepseek') {
    const provider = createOpenAI({ name: 'deepseek', apiKey: secrets.DEEPSEEK_API_KEY?.trim()!, baseURL: DEEPSEEK_BASE_URL });
    return { model: provider.chat(secrets.DEEPSEEK_MODEL?.trim() || 'deepseek-reasoner'), stripTools: domestic.stripTools };
  }
  // Qwen's built-in web search lets mainland users get live answers (weather, news) without OpenAI's search tool.
  const provider = createOpenAI({ name: 'dashscope', apiKey: secrets.DASHSCOPE_API_KEY?.trim()!, baseURL: DOMESTIC_BASE_URL, fetch: withQwenSearch });
  return { model: provider.chat(secrets.DASHSCOPE_MODEL?.trim() || 'qwen-plus'), stripTools: domestic.stripTools };
}

type AnyModel = Record<string, any>;
export function withRegionFallback<T extends object>(primary: T, fallback: { model: AnyModel; stripTools: boolean } | null): T {
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
            const tools = fallback.stripTools
              ? undefined
              : Array.isArray(options['tools']) ? options['tools'].filter((t: AnyModel) => t['type'] === 'function') : undefined;
            return fallback.model[prop]({ ...options, providerOptions, tools });
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
  const domestic = selectDomesticModel(secrets, deepThink);
  if (selected.kind === 'anthropic') {
    const provider = createAnthropic({ apiKey: selected.apiKey, baseURL: 'https://api.anthropic.com/v1' });
    return {
      kind: selected.kind,
      model: withRegionFallback(provider('claude-sonnet-4-6'), domestic && createDomesticModel(secrets, domestic)),
      webSearch: () => provider.tools.webSearch_20260209(),
      providerOptions: { anthropic: { sendReasoning: false, thinking: { type: 'adaptive' as const }, effort: deepThink ? 'high' as const : 'low' as const } },
      wrapResponse: (response: Response) => response,
    };
  }
  if (selected.kind === 'openai') {
    const provider = createOpenAI({ apiKey: selected.apiKey, baseURL: 'https://api.openai.com/v1' });
    return {
      kind: selected.kind,
      model: withRegionFallback(provider.responses(secrets.OPENAI_MODEL?.trim() || 'gpt-6-sol'), domestic && createDomesticModel(secrets, domestic)),
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
    model: withRegionFallback(provider.responses('openai/gpt-6-sol'), domestic && createDomesticModel(secrets, domestic)),
    webSearch: () => provider.tools.webSearch(),
    providerOptions: { openai: thinkOptions(deepThink) },
    wrapResponse: (response: Response) => withLovableAiGatewayRunIdHeader(response, runIdFetch),
  };
}