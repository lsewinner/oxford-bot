import { describe, expect, it, vi } from "vitest";
import { isRegionBlocked, withRegionFallback } from "@/lib/ai/provider.server";

describe("region fallback", () => {
  it("recognises only explicit region refusals", () => {
    expect(isRegionBlocked({ statusCode: 403, responseBody: '{"error":{"code":"unsupported_country_region_territory"}}' })).toBe(true);
    expect(isRegionBlocked({ message: "Country, region, or territory not supported" })).toBe(true);
    expect(isRegionBlocked({ statusCode: 403, responseBody: "permission denied" })).toBe(false);
    expect(isRegionBlocked({ statusCode: 401, responseBody: "unsupported_country" })).toBe(false);
  });

  it("switches to the domestic model on region refusal and strips OpenAI-only options", async () => {
    const primary = { doStream: vi.fn().mockRejectedValue({ statusCode: 403, responseBody: "unsupported_country_region_territory" }) };
    const fallback = { doStream: vi.fn().mockResolvedValue("domestic") };
    const model = withRegionFallback(primary, fallback);
    const out = await model.doStream({ providerOptions: { openai: { forceReasoning: true } }, tools: [{ type: "function" }, { type: "provider" }] } as never);
    expect(out).toBe("domestic");
    expect(fallback.doStream).toHaveBeenCalledWith({ providerOptions: {}, tools: [{ type: "function" }] });
  });

  it("never switches on other failures", async () => {
    const primary = { doStream: vi.fn().mockRejectedValue({ statusCode: 402, responseBody: "insufficient" }) };
    const fallback = { doStream: vi.fn() };
    await expect(withRegionFallback(primary, fallback).doStream({} as never)).rejects.toMatchObject({ statusCode: 402 });
    expect(fallback.doStream).not.toHaveBeenCalled();
  });
});
