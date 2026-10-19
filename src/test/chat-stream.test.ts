import { describe, expect, it, vi } from "vitest";
import { withLovableAiGatewayRunIdHeader } from "@/lib/ai/run-id";

describe("chat streaming boundary", () => {
  it("returns the original stream without waiting for diagnostic metadata", async () => {
    const waitForRunId = vi.fn(() => new Promise<string | undefined>(() => {}));
    const body = new ReadableStream<Uint8Array>();
    const response = await withLovableAiGatewayRunIdHeader(new Response(body), {
      getRunId: () => undefined,
      waitForRunId,
    });
    expect(waitForRunId).not.toHaveBeenCalled();
    expect(response.body).toBe(body);
    expect(body.locked).toBe(false);
    await body.cancel();
  });

  it("forwards split thinking and answer chunks and preserves cancellation", async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(value) { controller = value; },
      cancel,
    });
    const response = await withLovableAiGatewayRunIdHeader(new Response(body), {
      getRunId: () => "gateway-issued-id",
      waitForRunId: vi.fn(),
    });
    expect(response.headers.get("X-Lovable-AIG-Run-ID")).toBe("gateway-issued-id");
    const reader = response.body?.getReader();
    if (!reader || !controller) throw new Error("Missing streaming reader");
    for (const chunk of ["data: metadata\n\n", "data: thinking\n\n", "data: answer\n\n"]) {
      controller.enqueue(new TextEncoder().encode(chunk));
      const result = await reader.read();
      expect(new TextDecoder().decode(result.value)).toBe(chunk);
    }
    await reader.cancel("user-stop");
    expect(cancel).toHaveBeenCalledWith("user-stop");
  });
});