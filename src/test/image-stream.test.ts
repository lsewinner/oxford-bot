import { afterEach, describe, expect, it, vi } from "vitest";
import { streamImage } from "@/lib/stream-image";

afterEach(() => vi.unstubAllGlobals());
describe("image streaming", () => {
  it("renders preview and completion while draining all bytes", async () => {
    const fetcher = vi.fn(async () => new Response('event: image_generation.partial_image\ndata: {"b64_json":"YQ=="}\n\nevent: image_generation.completed\ndata: {"b64_json":"Yg=="}\n\n'));
    vi.stubGlobal("fetch", fetcher);
    const frame = vi.fn();
    await streamImage("/api/generate-image", { prompt: "猫" }, frame);
    expect(frame.mock.calls).toEqual([["data:image/png;base64,YQ==", false], ["data:image/png;base64,Yg==", true]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not replay a terminal refusal after a partial frame", async () => {
    const fetcher = vi.fn(async () => new Response('event: image_generation.partial_image\ndata: {"b64_json":"YQ=="}\n\nevent: error\ndata: {"error":{"message":"provider denied"}}\n\n'));
    vi.stubGlobal("fetch", fetcher);
    await expect(streamImage("/api/generate-image", { prompt: "猫" }, vi.fn())).rejects.toThrow("provider denied");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});