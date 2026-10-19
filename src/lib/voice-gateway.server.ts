import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ai.gateway.lovable.dev";
export const TRANSCRIBE_MODEL = "openai/gpt-transcribe";
export const SPEECH_MODEL = "google/gemini-3.1-flash-tts-preview";
export const SPEECH_VOICE = "Kore";
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_SPEECH_CHARS = 1500;

/** Signed-in callers must present a valid token; guests may use voice like guest chat. */
export async function verifyOptionalCaller(request: Request): Promise<Response | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return Response.json({ error: "登录服务未配置" }, { status: 500 });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "登录已失效，请重新登录" }, { status: 401 });
  return null;
}

export function transcribe(apiKey: string, file: File, signal?: AbortSignal) {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", file, file.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  return fetch(`${BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    ...(signal ? { signal } : {}),
  });
}

export function requestSpeech(apiKey: string, text: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEECH_VOICE } } },
      },
      stream_format: "sse",
    }),
    ...(signal ? { signal } : {}),
  });
}

export function passthrough(upstream: Response) {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-cache" },
  });
}

export function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
