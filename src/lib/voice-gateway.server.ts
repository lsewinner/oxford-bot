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

export const OPENAI_BASE_URL = "https://api.openai.com";
export const OPENAI_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
export const OPENAI_SPEECH_MODEL = "gpt-4o-mini-tts";
export const OPENAI_SPEECH_VOICE = "alloy";

export type VoiceCredentials = { apiKey: string; direct: boolean };

/** Own OpenAI key first (no platform credits), otherwise the gateway. */
export function selectVoiceCredentials(secrets: { OPENAI_API_KEY?: string | undefined; LOVABLE_API_KEY?: string | undefined }): VoiceCredentials | null {
  const own = secrets.OPENAI_API_KEY?.trim();
  if (own) return { apiKey: own, direct: true };
  const gateway = secrets.LOVABLE_API_KEY?.trim();
  return gateway ? { apiKey: gateway, direct: false } : null;
}

export function voiceCredentialsFromEnv() {
  return selectVoiceCredentials({ OPENAI_API_KEY: process.env["OPENAI_API_KEY"], LOVABLE_API_KEY: process.env["LOVABLE_API_KEY"] });
}

export function transcribe(creds: VoiceCredentials, file: File, signal?: AbortSignal) {
  const form = new FormData();
  form.append("model", creds.direct ? OPENAI_TRANSCRIBE_MODEL : TRANSCRIBE_MODEL);
  form.append("file", file, file.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  return fetch(`${creds.direct ? OPENAI_BASE_URL : BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.apiKey}` },
    body: form,
    redirect: "error",
    ...(signal ? { signal } : {}),
  });
}

export function requestSpeech(creds: VoiceCredentials, text: string, signal?: AbortSignal) {
  const body = creds.direct
    ? { model: OPENAI_SPEECH_MODEL, voice: OPENAI_SPEECH_VOICE, input: text, response_format: "pcm", stream_format: "sse" }
    : {
        model: SPEECH_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEECH_VOICE } } },
        },
        stream_format: "sse",
      };
  return fetch(`${creds.direct ? OPENAI_BASE_URL : BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
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
