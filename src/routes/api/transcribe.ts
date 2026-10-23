import { createFileRoute } from "@tanstack/react-router";
import { MAX_AUDIO_BYTES, isAbort, gatewayFallbackFromEnv, withVoiceFallback, transcribe, verifyOptionalCaller, voiceCredentialsFromEnv } from "@/lib/voice-gateway.server";

export const Route = createFileRoute("/api/transcribe")({
  server: { handlers: { POST: async ({ request }) => {
    const apiKey = voiceCredentialsFromEnv();
    if (!apiKey) return Response.json({ error: "AI 服务未配置" }, { status: 500 });
    const denied = await verifyOptionalCaller(request);
    if (denied) return denied;
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_AUDIO_BYTES + 64 * 1024) return Response.json({ error: "录音太长，请分段说话" }, { status: 413 });
    let file: FormDataEntryValue | null;
    try { file = (await request.formData()).get("file"); } catch { return Response.json({ error: "录音上传失败" }, { status: 400 }); }
    if (!(file instanceof File) || file.size < 2048 || file.size > MAX_AUDIO_BYTES || !file.type.startsWith("audio/")) {
      return Response.json({ error: "没有录到有效的声音，请再试一次" }, { status: 400 });
    }
    try {
      const text = file;
      return await withVoiceFallback(apiKey, gatewayFallbackFromEnv(), (c) => transcribe(c, text, request.signal));
    } catch (error) {
      if (isAbort(error)) return new Response(null, { status: 499 });
      return Response.json({ error: "语音识别服务暂时不可用" }, { status: 502 });
    }
  } } },
});
