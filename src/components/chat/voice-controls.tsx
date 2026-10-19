import { Loader2Icon, MicIcon, PauseIcon, PlayIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { playSpeech, recordWav, transcribeFile, type Recorder, type SpeechPlayer } from "@/lib/voice-client";

function Bars({ className, active = true }: { className?: string; active?: boolean }) {
  return (
    <span className={cn("inline-flex h-3.5 items-center gap-[2px]", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-full w-[2px] origin-center rounded-full bg-current"
          style={active ? { animation: `voice-bar 0.9s ease-in-out ${i * 0.15}s infinite` } : { transform: "scaleY(0.35)" }}
        />
      ))}
    </span>
  );
}

const AUTO_SEND_KEY = "oxford-voice-autosend";

/** Hold to talk. Release fills the composer, or sends directly when 「直接发送」 is on. */
export function VoiceInputButton({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string, autoSend: boolean) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [autoSend, setAutoSend] = useState(false);
  const [level, setLevel] = useState(0);
  const recorder = useRef<Recorder | null>(null);
  const starting = useRef<Promise<void> | null>(null);
  const released = useRef(false);

  useEffect(() => { setAutoSend(localStorage.getItem(AUTO_SEND_KEY) === "1"); }, []);
  useEffect(() => () => recorder.current?.cancel(), []);
  useEffect(() => {
    if (state !== "recording") return;
    let raf = 0;
    const tick = () => { setLevel(recorder.current?.level() ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const start = () => {
    if (disabled || state !== "idle") return;
    released.current = false;
    setState("recording");
    starting.current = recordWav()
      .then((r) => { recorder.current = r; if (released.current) void finish(); })
      .catch(() => { setState("idle"); toast.error("无法使用麦克风，请在浏览器中允许麦克风权限"); });
  };

  const finish = async () => {
    released.current = true;
    const r = recorder.current;
    if (!r) return; // still starting; finish runs once ready
    recorder.current = null;
    setState("transcribing");
    try {
      const file = await r.stop();
      const text = await transcribeFile(file);
      if (!text) toast.error("没有听清，请再说一次");
      else onTranscript(text, autoSend);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "语音识别失败");
    } finally {
      setState("idle");
    }
  };

  const toggleAuto = () => {
    const next = !autoSend;
    setAutoSend(next);
    localStorage.setItem(AUTO_SEND_KEY, next ? "1" : "0");
    toast(next ? "松开后将直接发送" : "松开后将填入输入框");
  };

  const recording = state === "recording";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={recording ? "松开结束录音" : "按住说话"}
        title="按住说话"
        disabled={disabled || state === "transcribing"}
        onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start(); }}
        onPointerUp={() => { if (recording) void finish(); }}
        onPointerCancel={() => { if (recording) void finish(); }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={(e) => { if ((e.key === " " || e.key === "Enter") && recording) void finish(); }}
        className={cn(
          "relative flex size-8 touch-none select-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
          recording && "voice-metal text-foreground",
        )}
      >
        {recording && (
          <span
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-ring"
            style={{ animation: "voice-ring 1.2s ease-out infinite", transform: `scale(${1 + level * 0.6})` }}
          />
        )}
        {state === "transcribing" ? <Loader2Icon className="size-4 animate-spin" /> : recording ? <Bars /> : <MicIcon className="size-4" />}
      </button>
      {recording ? (
        <span className="whitespace-nowrap text-xs text-muted-foreground">正在聆听，松开结束</span>
      ) : state === "transcribing" ? (
        <span className="whitespace-nowrap text-xs text-muted-foreground">识别中…</span>
      ) : (
        <button
          type="button"
          onClick={toggleAuto}
          aria-pressed={autoSend}
          className={cn(
            "hidden rounded-full px-2 py-0.5 text-[11px] transition-colors sm:inline",
            autoSend ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {autoSend ? "直接发送" : "填入输入框"}
        </button>
      )}
    </div>
  );
}

let activePlayer: { stop: () => void } | null = null;

/** Read a Bot reply aloud with play / pause / stop. */
export function SpeakControls({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const player = useRef<SpeechPlayer | null>(null);
  const handle = useRef<{ stop: () => void } | null>(null);

  const stop = () => {
    player.current?.stop();
    player.current = null;
    if (activePlayer === handle.current) activePlayer = null;
    setState("idle");
  };
  useEffect(() => () => player.current?.stop(), []);

  const play = () => {
    activePlayer?.stop();
    const p = playSpeech(text);
    player.current = p;
    const h = { stop };
    handle.current = h;
    activePlayer = h;
    setState("loading");
    const poll = setInterval(() => {
      if (player.current !== p) return clearInterval(poll);
      const data = new Uint8Array(p.analyser.frequencyBinCount);
      p.analyser.getByteFrequencyData(data);
      if (data.some((v) => v > 0)) { setState((s) => (s === "loading" ? "playing" : s)); clearInterval(poll); }
    }, 120);
    p.done
      .catch((e) => { if (player.current === p) toast.error(e instanceof Error ? e.message : "朗读失败"); })
      .finally(() => { clearInterval(poll); if (player.current === p) stop(); });
  };

  const btn = "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  if (state === "idle") {
    return <button type="button" className={btn} onClick={play} aria-label="朗读" title="朗读"><Volume2Icon className="size-3.5" /></button>;
  }
  return (
    <div className="voice-metal flex items-center gap-0.5 rounded-full py-0.5 pl-2 pr-0.5 text-foreground">
      {state === "loading" ? <Loader2Icon className="size-3.5 animate-spin" /> : <Bars active={state === "playing"} />}
      <span className="ml-1 mr-1 text-[11px] text-muted-foreground">{state === "loading" ? "准备朗读" : state === "playing" ? "朗读中" : "已暂停"}</span>
      {state !== "loading" && (
        <button
          type="button"
          className={cn(btn, "rounded-full")}
          aria-label={state === "playing" ? "暂停" : "继续"}
          onClick={async () => {
            const p = player.current;
            if (!p) return;
            if (state === "playing") { await p.pause(); setState("paused"); } else { await p.resume(); setState("playing"); }
          }}
        >
          {state === "playing" ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        </button>
      )}
      <button type="button" className={cn(btn, "rounded-full")} aria-label="停止朗读" onClick={stop}><SquareIcon className="size-3" /></button>
    </div>
  );
}
