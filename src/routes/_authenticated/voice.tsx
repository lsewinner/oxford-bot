import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { recordWav, transcribeFile, playSpeech, type Recorder, type SpeechPlayer } from "@/lib/voice-client";
import { MicIcon, MicOffIcon, PhoneOffIcon, PlayIcon, XIcon, AudioLinesIcon, HandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({
    meta: [
      { title: "实时语音 · Oxford Bot" },
      { name: "description", content: "与 Oxford Bot 全屏实时语音对讲，可随时打断，并能查阅你的 Smart Brain。" },
      { property: "og:title", content: "实时语音 · Oxford Bot" },
      { property: "og:description", content: "全屏沉浸式实时语音对讲。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VoicePage,
});

type Phase = "idle" | "listening" | "thinking" | "speaking";
type Line = { role: "user" | "assistant"; text: string };

function VoicePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const lastRole = useRef<Line["role"] | null>(null);
  // After a manual interrupt, the rest of the current answer stays silent until the user speaks again.
  const interrupted = useRef(false);

  const onEvent = (event: LiveEvent) => {
    const t = event.type;
    if (t === "app.connected") setPhase("listening");
    else if (t === "app.closed") { setPhase("idle"); interrupted.current = false; }
    else if (t === "app.delegation.pending") { if (!interrupted.current) setPhase("thinking"); }
    else if (t === "session.input_transcript.delta" || t === "session.output_transcript.delta") {
      const role = t === "session.input_transcript.delta" ? "user" : "assistant";
      const delta = typeof event["delta"] === "string" ? event["delta"] : "";
      if (!delta) return;
      if (role === "user" && interrupted.current) {
        interrupted.current = false;
        if (call.audioRef.current) call.audioRef.current.muted = false;
      }
      if (role === "assistant" && interrupted.current) return;
      setPhase(role === "user" ? "listening" : "speaking");
      setLines((prev) => {
        const next = [...prev];
        if (lastRole.current === role && next.length) {
          next[next.length - 1] = { role, text: (next[next.length - 1]?.text ?? "") + delta };
        } else next.push({ role, text: delta });
        lastRole.current = role;
        return next.slice(-6);
      });
    }
  };

  const call = useLiveVoice({
    onEvent,
    getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
  });
  const interruptLive = () => {
    interrupted.current = true;
    if (call.audioRef.current) call.audioRef.current.muted = true;
    if (call.muted) call.setMuted(false);
    setPhase("listening");
  };
  const startLive = () => {
    interrupted.current = false;
    if (call.audioRef.current) call.audioRef.current.muted = false;
    setLines([]); lastRole.current = null; call.start();
  };
  // Compatibility mode: turn-based recording → transcription → reply → read aloud.
  const [compat, setCompat] = useState(false);
  const [compatBusy, setCompatBusy] = useState<"idle" | "recording" | "thinking" | "speaking">("idle");
  const [compatError, setCompatError] = useState<string | null>(null);
  const history = useRef<Line[]>([]);
  const recorder = useRef<Recorder | null>(null);
  const player = useRef<SpeechPlayer | null>(null);
  useEffect(() => { if (localStorage.getItem("oxford-voice-compat") === "1") setCompat(true); }, []);
  useEffect(() => {
    if (call.error && /country|region|territory|not supported|不支持/i.test(call.error)) {
      void call.stop(); setCompat(true); localStorage.setItem("oxford-voice-compat", "1");
      setCompatError("当前网络暂不支持实时对讲，已切换为兼容模式");
    }
  }, [call.error]);
  useEffect(() => () => { recorder.current?.cancel(); player.current?.stop(); }, []);
  const toggleCompat = (on: boolean) => {
    recorder.current?.cancel(); recorder.current = null; player.current?.stop(); player.current = null;
    setCompatBusy("idle"); setCompatError(null); setCompat(on);
    localStorage.setItem("oxford-voice-compat", on ? "1" : "0");
    if (on) void call.stop();
  };
  const pushLine = (line: Line) => {
    history.current = [...history.current, line].slice(-12);
    setLines(history.current.slice(-6));
  };
  const turn = useRef(0);
  const beginRecording = async () => {
    try { recorder.current = await recordWav(); setCompatBusy("recording"); }
    catch { setCompatError("无法使用麦克风，请在浏览器设置中允许麦克风权限"); setCompatBusy("idle"); }
  };
  const compatTap = async () => {
    setCompatError(null);
    // Speaking or thinking: interrupt the current answer and listen right away.
    if (compatBusy === "speaking" || compatBusy === "thinking") {
      turn.current++;
      player.current?.stop(); player.current = null;
      await beginRecording();
      return;
    }
    if (compatBusy === "idle") { await beginRecording(); return; }
    const rec = recorder.current; recorder.current = null;
    if (!rec) return;
    const mine = ++turn.current;
    const stale = () => turn.current !== mine;
    setCompatBusy("thinking");
    try {
      const said = (await transcribeFile(await rec.stop())).trim();
      if (stale()) return;
      if (!said) throw new Error("没有听清，请再说一次");
      pushLine({ role: "user", text: said });
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/voice-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ lines: history.current }),
      });
      const data = await res.json().catch(() => ({})) as { text?: string; error?: string };
      if (stale()) return;
      if (!res.ok || !data.text) throw new Error(data.error ?? "回答失败，请再试一次");
      pushLine({ role: "assistant", text: data.text });
      setCompatBusy("speaking");
      const p = playSpeech(data.text); player.current = p;
      await p.done.catch(() => undefined);
      if (player.current === p) { player.current = null; setCompatBusy("idle"); }
    } catch (error) {
      if (stale()) return;
      setCompatError(error instanceof Error ? error.message : "出错了，请再试一次");
      setCompatBusy("idle");
    }
  };

  const live = call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  const liveActive = call.status === "connected";
  const canInterrupt = liveActive && (phase === "speaking" || phase === "thinking");
  const label =
    call.status === "connecting" ? "正在连接…" :
    call.status === "stopping" ? "正在结束…" :
    !live ? "点击开始对讲" :
    call.muted ? "麦克风已静音" :
    phase === "thinking" ? "思考中 · 点一下打断" : phase === "speaking" ? "回答中 · 开口或点一下即可打断" : "聆听中…";
  const recent = lines.slice(-2);
  const shownPhase: Phase = compat ? (compatBusy === "recording" ? "listening" : compatBusy === "idle" ? "idle" : compatBusy) : phase;
  const compatLabel = compatBusy === "recording" ? "聆听中 · 说完点一下" : compatBusy === "thinking" ? "思考中 · 点一下打断" : compatBusy === "speaking" ? "回答中 · 点一下打断" : "点一下开始说话";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-8 text-foreground">
      <div className="flex w-full max-w-3xl items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-muted-foreground">{compat ? "OXFORD VOICE · 兼容模式" : "OXFORD LIVE"}</span>
        <Button asChild variant="ghost" size="icon" aria-label="退出实时语音" onClick={() => call.stop()}>
          <Link to="/chat"><XIcon className="size-5" /></Link>
        </Button>
      </div>

      <button
        type="button"
        aria-label={compat ? compatLabel : canInterrupt ? "打断回答" : live ? "对讲中" : "开始对讲"}
        onClick={() => {
          if (compat) void compatTap();
          else if (canInterrupt) interruptLive();
          else if (!live) startLive();
        }}
        className="relative flex size-64 items-center justify-center rounded-full outline-none sm:size-80"
      >
        <span className={cn("absolute inset-0 rounded-full bg-primary/10 blur-3xl transition-all duration-700",
          shownPhase === "speaking" && "scale-110 bg-primary/25", shownPhase === "thinking" && "animate-pulse")} />
        <span className={cn("absolute inset-8 rounded-full border border-primary/20 transition-all duration-700",
          shownPhase === "listening" && "animate-ping [animation-duration:2.4s]", shownPhase === "thinking" && "animate-spin border-dashed [animation-duration:6s]")} />
        <span className={cn("relative size-40 rounded-full bg-gradient-to-br from-primary/90 via-primary/40 to-transparent shadow-[0_0_80px_hsl(var(--primary)/0.35)] transition-transform duration-500 sm:size-48",
          !(compat ? compatBusy !== "idle" : live) && "opacity-60", shownPhase === "speaking" && "scale-110 animate-pulse", shownPhase === "thinking" && "scale-90")} />
        {!(compat ? compatBusy !== "idle" : live) && <AudioLinesIcon className="absolute size-10 text-background" />}
      </button>

      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-live="polite">{compat ? compatLabel : label}</p>
        <div className="min-h-24 w-full space-y-2 text-center">
          {recent.map((l, i) => (
            <p key={i} className={cn("text-balance", l.role === "user" ? "text-sm text-muted-foreground" : "text-lg")}>{l.text}</p>
          ))}
        </div>
        {compat && <p className="text-center text-xs text-muted-foreground">当前网络不支持实时对讲，已切换为按轮次语音：点一下说话，说完再点一下。</p>}
        {(compat ? compatError : call.error) && <p className="text-sm text-destructive">{compat ? compatError : call.error}</p>}
        {call.playbackBlocked && (
          <Button variant="secondary" onClick={() => call.resumePlayback()}><PlayIcon className="size-4" />点击播放声音</Button>
        )}
        <div className="flex items-center gap-4">
          {compat ? (
            <Button size="lg" className="rounded-full px-8" onClick={() => void compatTap()}>
              <MicIcon className="size-4" />{compatBusy === "recording" ? "说完了" : compatBusy === "idle" ? "开始说话" : "打断并说话"}
            </Button>
          ) : live ? (
            <>
              <Button variant="secondary" size="icon" className="size-12 rounded-full" aria-label={call.muted ? "取消静音" : "静音"} onClick={() => call.setMuted(!call.muted)}>
                {call.muted ? <MicOffIcon /> : <MicIcon />}
              </Button>
              {canInterrupt && (
                <Button variant="secondary" size="lg" className="rounded-full px-6" onClick={interruptLive}>
                  <HandIcon className="size-4" />打断
                </Button>
              )}
              <Button variant="destructive" size="icon" className="size-14 rounded-full" aria-label="挂断" onClick={() => call.stop()}>
                <PhoneOffIcon />
              </Button>
            </>
          ) : (
            <Button size="lg" className="rounded-full px-8" onClick={startLive}>
              <MicIcon className="size-4" />开始对讲
            </Button>
          )}
        </div>
        <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => toggleCompat(!compat)}>
          {compat ? "尝试实时对讲" : "网络不稳定？切换到兼容模式"}
        </button>
        <audio ref={call.audioRef} className="hidden" />
      </div>
    </div>
  );
}
