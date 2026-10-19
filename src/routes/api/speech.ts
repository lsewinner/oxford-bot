import { createFileRoute } from "@tanstack/react-router";
import { MAX_SPEECH_CHARS, isAbort, passthrough, requestSpeech, verifyOptionalCaller } from "@/lib/voice-gateway.server";

export const Route = createFileRoute("/api/speech")({
  server: { handlers: { POST: async ({ request }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return Response.json({ error: "AI 服务未配置" }, { status: 500 });
    const denied = await verifyOptionalCaller(request);
    if (denied) return denied;
    let body: { text?: unknown };
    try { body = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > MAX_SPEECH_CHARS) {
      return Response.json({ error: "朗读内容无效" }, { status: 400 });
    }
    try {
      return passthrough(await requestSpeech(apiKey, body.text, request.signal));
    } catch (error) {
      if (isAbort(error)) return new Response(null, { status: 499 });
      return Response.json({ error: "语音朗读服务暂时不可用" }, { status: 502 });
    }
  } } },
});
