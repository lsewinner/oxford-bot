import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { MicIcon, MicOffIcon, PhoneOffIcon, PlayIcon, XIcon, AudioLinesIcon } from "lucide-react";
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

  const onEvent = (event: LiveEvent) => {
    const t = event.type;
    if (t === "app.connected") setPhase("listening");
    else if (t === "app.closed") setPhase("idle");
    else if (t === "app.delegation.pending") setPhase("thinking");
    else if (t === "session.input_transcript.delta" || t === "session.output_transcript.delta") {
      const role = t === "session.input_transcript.delta" ? "user" : "assistant";
      const delta = typeof event["delta"] === "string" ? event["delta"] : "";
      if (!delta) return;
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
  const live = call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  const label =
    call.status === "connecting" ? "正在连接…" :
    call.status === "stopping" ? "正在结束…" :
    !live ? "点击开始对讲" :
    call.muted ? "麦克风已静音" :
    phase === "thinking" ? "思考中…" : phase === "speaking" ? "回答中 · 说话即可打断" : "聆听中…";
  const recent = lines.slice(-2);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-8 text-foreground">
      <div className="flex w-full max-w-3xl items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-muted-foreground">OXFORD LIVE</span>
        <Button asChild variant="ghost" size="icon" aria-label="退出实时语音" onClick={() => call.stop()}>
          <Link to="/chat"><XIcon className="size-5" /></Link>
        </Button>
      </div>

      <button
        type="button"
        aria-label={live ? "结束对讲" : "开始对讲"}
        onClick={() => (live ? call.stop() : call.start())}
        className="relative flex size-64 items-center justify-center rounded-full outline-none sm:size-80"
      >
        <span className={cn("absolute inset-0 rounded-full bg-primary/10 blur-3xl transition-all duration-700",
          phase === "speaking" && "scale-110 bg-primary/25", phase === "thinking" && "animate-pulse")} />
        <span className={cn("absolute inset-8 rounded-full border border-primary/20 transition-all duration-700",
          phase === "listening" && "animate-ping [animation-duration:2.4s]", phase === "thinking" && "animate-spin border-dashed [animation-duration:6s]")} />
        <span className={cn("relative size-40 rounded-full bg-gradient-to-br from-primary/90 via-primary/40 to-transparent shadow-[0_0_80px_hsl(var(--primary)/0.35)] transition-transform duration-500 sm:size-48",
          !live && "opacity-60", phase === "speaking" && "scale-110 animate-pulse", phase === "thinking" && "scale-90")} />
        {!live && <AudioLinesIcon className="absolute size-10 text-background" />}
      </button>

      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-live="polite">{label}</p>
        <div className="min-h-24 w-full space-y-2 text-center">
          {recent.map((l, i) => (
            <p key={i} className={cn("text-balance", l.role === "user" ? "text-sm text-muted-foreground" : "text-lg")}>{l.text}</p>
          ))}
        </div>
        {call.error && <p className="text-sm text-destructive">{call.error}</p>}
        {call.playbackBlocked && (
          <Button variant="secondary" onClick={() => call.resumePlayback()}><PlayIcon className="size-4" />点击播放声音</Button>
        )}
        <div className="flex items-center gap-4">
          {live ? (
            <>
              <Button variant="secondary" size="icon" className="size-12 rounded-full" aria-label={call.muted ? "取消静音" : "静音"} onClick={() => call.setMuted(!call.muted)}>
                {call.muted ? <MicOffIcon /> : <MicIcon />}
              </Button>
              <Button variant="destructive" size="icon" className="size-14 rounded-full" aria-label="挂断" onClick={() => call.stop()}>
                <PhoneOffIcon />
              </Button>
            </>
          ) : (
            <Button size="lg" className="rounded-full px-8" onClick={() => { setLines([]); lastRole.current = null; call.start(); }}>
              <MicIcon className="size-4" />开始对讲
            </Button>
          )}
        </div>
        <audio ref={call.audioRef} className="hidden" />
      </div>
    </div>
  );
}
