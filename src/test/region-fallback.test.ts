import { describe, expect, it, vi } from "vitest";
import { isRegionBlocked, selectDomesticModel, withRegionFallback } from "@/lib/ai/provider.server";

describe("region fallback", () => {
  it("recognises only explicit region refusals", () => {
    expect(isRegionBlocked({ statusCode: 403, responseBody: '{"error":{"code":"unsupported_country_region_territory"}}' })).toBe(true);
    expect(isRegionBlocked({ message: "Country, region, or territory not supported" })).toBe(true);
    expect(isRegionBlocked({ statusCode: 403, responseBody: "permission denied" })).toBe(false);
    expect(isRegionBlocked({ statusCode: 401, responseBody: "unsupported_country" })).toBe(false);
  });

  it("picks DeepSeek only for Deep Think with a key, Qwen otherwise", () => {
    const secrets = { DEEPSEEK_API_KEY: "deepseek-test", DASHSCOPE_API_KEY: "dash-test" };
    expect(selectDomesticModel(secrets, true)).toEqual({ provider: "deepseek", stripTools: true });
    expect(selectDomesticModel(secrets, false)).toEqual({ provider: "dashscope", stripTools: false });
    expect(selectDomesticModel({ DASHSCOPE_API_KEY: "dash-test" }, true)).toEqual({ provider: "dashscope", stripTools: false });
    expect(selectDomesticModel({}, true)).toBeNull();
    expect(selectDomesticModel({ DEEPSEEK_API_KEY: "deepseek-test" }, false)).toBeNull();
  });

  it("switches to the domestic model on region refusal and strips OpenAI-only options", async () => {
    const primary = { doStream: vi.fn().mockRejectedValue({ statusCode: 403, responseBody: "unsupported_country_region_territory" }) };
    const fallback = { doStream: vi.fn().mockResolvedValue("domestic") };
    const model = withRegionFallback(primary, { model: fallback, stripTools: false });
    const out = await model.doStream({ providerOptions: { openai: { forceReasoning: true } }, tools: [{ type: "function" }, { type: "provider" }] } as never);
    expect(out).toBe("domestic");
    expect(fallback.doStream).toHaveBeenCalledWith({ providerOptions: {}, tools: [{ type: "function" }] });
  });

  it("drops all tools for the DeepSeek reasoner fallback", async () => {
    const primary = { doStream: vi.fn().mockRejectedValue({ statusCode: 403, responseBody: "unsupported_country_region_territory" }) };
    const fallback = { doStream: vi.fn().mockResolvedValue("domestic") };
    const model = withRegionFallback(primary, { model: fallback, stripTools: true });
    await model.doStream({ providerOptions: { openai: { reasoningEffort: "high" } }, tools: [{ type: "function" }, { type: "provider" }] } as never);
    expect(fallback.doStream).toHaveBeenCalledWith({ providerOptions: {}, tools: undefined });
  });

  it("never switches on other failures", async () => {
    const primary = { doStream: vi.fn().mockRejectedValue({ statusCode: 402, responseBody: "insufficient" }) };
    const fallback = { doStream: vi.fn() };
    await expect(withRegionFallback(primary, { model: fallback, stripTools: false }).doStream({} as never)).rejects.toMatchObject({ statusCode: 402 });
    expect(fallback.doStream).not.toHaveBeenCalled();
  });
});

import { needsLiveSearch } from '@/lib/ai/provider.server';
describe('domestic live search', () => {
  it('forces search for weather questions only', () => {
    expect(needsLiveSearch('今天上海天气怎么样？')).toBe(true);
    expect(needsLiveSearch('帮我写一首诗')).toBe(false);
  });
});
