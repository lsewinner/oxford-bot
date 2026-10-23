import { describe, expect, it } from "vitest";
import { withVoiceFallback } from "@/lib/voice-gateway.server";

const direct = { apiKey: "openai", direct: true };
const gateway = { apiKey: "gw", direct: false };

describe("voice region fallback", () => {
  it("switches to the backup channel when OpenAI refuses the region", async () => {
    const used: boolean[] = [];
    const res = await withVoiceFallback(direct, gateway, async (c) => {
      used.push(c.direct);
      return c.direct ? new Response("unsupported_country", { status: 403 }) : new Response("ok", { status: 200 });
    });
    expect(used).toEqual([true, false]);
    expect(res.status).toBe(200);
  });

  it("does not retry on success", async () => {
    let calls = 0;
    await withVoiceFallback(direct, gateway, async () => { calls++; return new Response("ok"); });
    expect(calls).toBe(1);
  });

  it("returns a Chinese message instead of the raw English region error", async () => {
    const res = await withVoiceFallback(direct, null, async () => new Response("Country, region, or territory not supported", { status: 403 }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("地区");
  });
});
