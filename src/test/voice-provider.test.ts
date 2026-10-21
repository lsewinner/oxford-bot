import { describe, expect, it } from "vitest";
import { selectVoiceCredentials } from "@/lib/voice-gateway.server";

describe("voice provider selection", () => {
  it("uses own OpenAI key first", () => {
    expect(selectVoiceCredentials({ OPENAI_API_KEY: "sk-own", LOVABLE_API_KEY: "gw" })).toEqual({ apiKey: "sk-own", direct: true });
  });
  it("falls back to gateway without OpenAI key", () => {
    expect(selectVoiceCredentials({ LOVABLE_API_KEY: "gw" })).toEqual({ apiKey: "gw", direct: false });
  });
  it("returns null when nothing configured", () => {
    expect(selectVoiceCredentials({})).toBeNull();
  });
});
