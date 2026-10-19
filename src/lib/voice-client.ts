import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function failure(response: Response, fallback: string) {
  const raw = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw) as { error?: string | { message?: string }; message?: string };
    const msg = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
    if (msg) return new Error(msg);
  } catch { /* not json */ }
  if (response.status === 429) return new Error("请求太频繁，请稍后再试");
  if (response.status === 402) return new Error("AI 额度不足，请充值后再试");
  return new Error(fallback);
}

/* ---------- Recording (complete WAV) ---------- */

export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (o: number, v: string) => { for (let i = 0; i < v.length; i++) view.setUint8(o + i, v.charCodeAt(i)); };
  tag(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const value of chunk) {
    const s = Math.max(-1, Math.min(1, value));
    view.setInt16(offset, s * (s < 0 ? 32768 : 32767), true);
    offset += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export type Recorder = { stop: () => Promise<File>; cancel: () => void; level: () => number };

export async function recordWav(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const node = context.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let lastLevel = 0;
  node.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    lastLevel = Math.min(1, Math.sqrt(sum / data.length) * 6);
  };
  source.connect(node);
  node.connect(context.destination);
  let done = false;
  const release = async () => {
    done = true;
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect(); source.disconnect(); node.onaudioprocess = null;
    await context.close().catch(() => undefined);
  };
  return {
    level: () => lastLevel,
    cancel: () => { if (!done) void release(); },
    async stop() {
      if (done) throw new Error("录音已结束");
      const blob = encodeWav(chunks, context.sampleRate);
      await release();
      if (blob.size < context.sampleRate * 2 * 0.4) throw new Error("说话时间太短，请按住久一点");
      return new File([blob], "recording.wav", { type: "audio/wav" });
    },
  };
}

export async function transcribeFile(file: File, onDelta?: (text: string) => void): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch("/api/transcribe", { method: "POST", headers: await authHeaders(), body: form });
  if (!response.ok || !response.body) throw await failure(response, "语音识别失败，请重试");
  let text = "";
  let final: string | null = null;
  let failed: string | null = null;
  const parser = createParser({
    onEvent(event) {
      if (event.data === "[DONE]") return;
      const p = JSON.parse(event.data) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
      if (p.error || p.type === "error") failed = p.error?.message ?? "语音识别失败";
      else if (p.type === "transcript.text.delta" && p.delta) { text += p.delta; onDelta?.(text); }
      else if (p.type === "transcript.text.done") final = p.text ?? text;
    },
  });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) { const n = await reader.read(); if (n.done) break; parser.feed(n.value); }
  if (failed) throw new Error(failed);
  if (final === null) throw new Error("语音识别未完成，请重试");
  return (final as string).trim();
}

/* ---------- Speech playback ---------- */

export function speakableText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, "（代码略）")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|]+/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function chunkText(text: string, max = 600): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const sentence of text.match(/[^.!?。！？\n]+[.!?。！？\n]*|[.!?。！？\n]+/gu) ?? []) {
    if (current.length + sentence.length <= max) { current += sentence; continue; }
    if (current.trim()) chunks.push(current);
    current = "";
    for (let i = 0; i < sentence.length; i += max) {
      const part = sentence.slice(i, i + max);
      if (i + max < sentence.length) chunks.push(part); else current = part;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export type SpeechPlayer = {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => void;
  analyser: AnalyserNode;
  done: Promise<void>;
};

export function playSpeech(markdown: string): SpeechPlayer {
  const context = new AudioContext({ sampleRate: 24000 });
  const analyser = context.createAnalyser();
  analyser.fftSize = 64;
  analyser.connect(context.destination);
  const controller = new AbortController();
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;

  const decode = (pending: Uint8Array, incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending); bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    const view = new DataView(bytes.buffer);
    const samples = new Float32Array(usable / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    return { samples, pending: bytes.slice(usable) };
  };

  const speakChunk = async (text: string) => {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw await failure(response, "朗读失败，请重试");
    let pending = new Uint8Array(0);
    let completed = false;
    let played = 0;
    let last: Promise<void> = Promise.resolve();
    let failed: string | null = null;
    const parser = createParser({
      onEvent(event) {
        const p = JSON.parse(event.data) as { type: string; audio?: string; error?: { message?: string } };
        if (p.type === "error" || p.error) { failed = p.error?.message ?? "朗读失败"; return; }
        if (p.type === "speech.audio.done") { completed = true; return; }
        if (p.type !== "speech.audio.delta" || !p.audio) return;
        const d = decode(pending, Uint8Array.from(atob(p.audio), (c) => c.charCodeAt(0)));
        pending = new Uint8Array(d.pending);
        if (!d.samples.length) return;
        played += d.samples.length;
        const buffer = context.createBuffer(1, d.samples.length, 24000);
        buffer.copyToChannel(d.samples, 0);
        const src = context.createBufferSource();
        src.buffer = buffer;
        src.connect(analyser);
        sources.add(src);
        last = new Promise((resolve) => { src.onended = () => { sources.delete(src); resolve(); }; });
        playhead = Math.max(playhead, context.currentTime + 0.05);
        src.start(playhead);
        playhead += buffer.duration;
      },
    });
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) { const n = await reader.read(); if (n.done) break; parser.feed(n.value); }
    if (failed) throw new Error(failed);
    if (!completed || !played) throw new Error("朗读未完成，请重试");
    return last;
  };

  const done = (async () => {
    try {
      if (context.state === "suspended") await context.resume();
      const chunks = chunkText(speakableText(markdown));
      if (!chunks.length) throw new Error("没有可朗读的内容");
      let tail: Promise<void> = Promise.resolve();
      for (const chunk of chunks) tail = await speakChunk(chunk);
      await tail;
    } finally {
      controller.abort();
      for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
      await context.close().catch(() => undefined);
    }
  })();

  return {
    analyser,
    done,
    pause: () => context.suspend(),
    resume: () => context.resume(),
    stop: () => { controller.abort(); for (const s of sources) { try { s.stop(); } catch { /* noop */ } } void context.close().catch(() => undefined); },
  };
}
