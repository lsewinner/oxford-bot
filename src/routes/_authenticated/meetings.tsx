import { tz } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, BrainCircuitIcon, CalendarIcon, LoaderCircleIcon, MicIcon, SquareIcon, Trash2Icon, UploadIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { transcribeFile } from "@/lib/voice-client";
import { createThread, pendingKey } from "@/lib/chat-data";
import { DISPATCH_TARGETS, MEETING_SEGMENT_MS, buildDispatchPrompt, type DispatchTarget } from "@/lib/meetings";
import { analyzeMeeting, deleteMeeting, listMeetings, saveMeetingToBrain, upcomingMeetings, type MeetingRow, type UpcomingMeeting } from "@/lib/meetings.functions";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: tz("会议助手 · Oxford Bot") },
      { name: "description", content: tz("录音或上传会议音频，自动生成纪要、决议与待办，并沉淀到 Smart Brain。") },
      { property: "og:title", content: tz("会议助手 · Oxford Bot") },
      { property: "og:description", content: tz("Oxford Bot 会议助手：转写、纪要、待办派发与知识沉淀。") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingsPage,
});

const MAX_UPLOAD = 20 * 1024 * 1024;

function MeetingsPage() {
  const list = useServerFn(listMeetings);
  const upcoming = useServerFn(upcomingMeetings);
  const analyze = useServerFn(analyzeMeeting);
  const qc = useQueryClient();
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai" : "Asia/Shanghai";
  const { data: meetings = [], isLoading } = useQuery({ queryKey: ["meetings"], queryFn: () => list() });
  const { data: cal } = useQuery({ queryKey: ["meetings-calendar"], queryFn: () => upcoming({ data: { timeZone: zone } }), retry: false });
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [event, setEvent] = useState<UpcomingMeeting | null>(null);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState("");
  const parts = useRef<string[]>([]);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const rec = useRef<{ stream: MediaStream; recorder: MediaRecorder | null; timer: number; tick: number; stopping: boolean; started: Date } | null>(null);

  const current = meetings.find((m) => m.id === selected) ?? null;
  useEffect(() => () => { const r = rec.current; if (r) { clearInterval(r.timer); clearInterval(r.tick); r.stream.getTracks().forEach((t) => t.stop()); } }, []);

  const queueTranscribe = (file: File, index: number) => {
    pending.current = pending.current.then(async () => {
      setStage(tz("正在转写第 {0} 段…", index + 1));
      parts.current[index] = await transcribeFile(file);
    });
  };

  const startSegment = (stream: MediaStream, index: number) => {
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const type = recorder.mimeType.split(";")[0] || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size >= 2048) queueTranscribe(new File([blob], `meeting-${index}.${type.includes("mp4") ? "m4a" : "webm"}`, { type }), index);
    };
    recorder.start(1000);
    return recorder;
  };

  const start = async () => {
    if (!consent) { toast.error(tz("请先确认所有参会者已知情并同意录音")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      parts.current = []; pending.current = Promise.resolve();
      let index = 0;
      const state = { stream, recorder: startSegment(stream, 0), timer: 0, tick: 0, stopping: false, started: new Date() };
      state.timer = window.setInterval(() => { state.recorder?.stop(); index += 1; state.recorder = startSegment(stream, index); }, MEETING_SEGMENT_MS);
      state.tick = window.setInterval(() => setElapsed(Math.round((Date.now() - state.started.getTime()) / 1000)), 1000);
      rec.current = state; setElapsed(0); setRecording(true);
    } catch { toast.error(tz("无法使用麦克风，请在浏览器中允许麦克风权限")); }
  };

  const finish = async (source: "record" | "upload", startedAt: Date) => {
    try {
      await pending.current;
      const transcript = parts.current.filter(Boolean).join("\n");
      if (transcript.trim().length < 20) throw new Error(tz("没有识别到足够的会议内容"));
      setStage(tz("OxfordAI 正在整理纪要…"));
      const row = await analyze({ data: { title: title.trim() || event?.title || tz("未命名会议"), source: event ? "calendar" : source, calendarEvent: event ? `${event.title} ${event.detail}`.trim() : "", startedAt: startedAt.toISOString(), transcript } });
      await qc.invalidateQueries({ queryKey: ["meetings"] });
      setSelected(row.id); setTitle(""); setEvent(null); setConsent(false);
      toast.success(tz("会议纪要已生成"));
    } catch (e) { toast.error(e instanceof Error ? e.message : tz("处理失败")); }
    finally { setStage(""); }
  };

  const stop = async () => {
    const r = rec.current; if (!r || r.stopping) return;
    r.stopping = true; clearInterval(r.timer); clearInterval(r.tick);
    await new Promise<void>((res) => { if (!r.recorder || r.recorder.state === "inactive") return res(); r.recorder.addEventListener("stop", () => res(), { once: true }); r.recorder.stop(); });
    r.stream.getTracks().forEach((t) => t.stop());
    rec.current = null; setRecording(false);
    await finish("record", r.started);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name);
    if (!isAudio || file.size > MAX_UPLOAD) { toast.error(tz("请上传 20MB 以内的音频文件（mp3 / m4a / wav / webm）")); return; }
    parts.current = []; pending.current = Promise.resolve();
    if (!title.trim() && !event) setTitle(file.name.replace(/\.[^.]+$/, ""));
    queueTranscribe(file, 0);
    await finish("upload", new Date(file.lastModified || Date.now()));
  };

  const busy = recording || Boolean(stage);
  const mm = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return <div className="min-h-dvh bg-background text-foreground">
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={tz("返回")}><Link to="/chat"><ArrowLeftIcon /></Link></Button>
        <div><h1 className="text-xl font-semibold">{tz("会议助手")}</h1><p className="text-sm text-muted-foreground">{tz("录音转写 → 纪要与待办 → 派发任务、沉淀到 Smart Brain")}</p></div>
      </div>
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-2">
          <Button variant={selected ? "outline" : "secondary"} onClick={() => setSelected(null)} disabled={busy}>{tz("＋ 新会议")}</Button>
          {isLoading ? <LoaderCircleIcon className="mx-auto mt-4 size-4 animate-spin text-muted-foreground" /> : meetings.length === 0 ? <p className="px-1 py-3 text-sm text-muted-foreground">{tz("还没有会议记录")}</p> :
            meetings.map((m) => <button key={m.id} type="button" onClick={() => setSelected(m.id)} className={`rounded-md border px-3 py-2 text-left text-sm transition ${m.id === selected ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}>
              <div className="truncate font-medium">{m.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(m.started_at ?? m.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}{m.brain_document_id ? tz(" · 已存入 Brain") : ""}</div>
            </button>)}
        </aside>
        <main className="min-w-0">
          {current ? <MeetingDetail meeting={current} onDeleted={() => setSelected(null)} /> : <div className="flex flex-col gap-5 rounded-lg border border-border p-5">
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium"><CalendarIcon className="size-4" />{tz("今日日程")}</h2>
              {!cal ? <p className="text-sm text-muted-foreground">{tz("读取日历中…")}</p> : !cal.connected ? <p className="text-sm text-muted-foreground">{tz("未连接日历。可在「工具与连接」中连接 Google 日历或 Outlook 日历，也可以直接开始录音。")}</p> : cal.events.length === 0 ? <p className="text-sm text-muted-foreground">{tz("今天没有更多日程")}</p> :
                <div className="flex flex-wrap gap-2">{cal.events.map((e) => <button key={e.id} type="button" disabled={busy} onClick={() => { setEvent(e); setTitle(e.title); }} className={`max-w-full rounded-md border px-3 py-1.5 text-left text-xs ${event?.id === e.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}><div className="truncate font-medium">{e.title}</div><div className="truncate text-muted-foreground">{e.provider}{e.detail ? ` · ${e.detail.slice(0, 60)}` : ""}</div></button>)}</div>}
            </section>
            <label className="flex flex-col gap-1.5 text-sm">{tz("会议主题")}
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} maxLength={200} placeholder={tz("例如：产品周会")} className="h-9 rounded-md border border-border bg-background px-3 text-sm" />
            </label>
            <label className="flex items-start gap-2 text-sm text-muted-foreground"><Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={busy} className="mt-0.5" />{tz("我已告知所有参会者并获得录音同意")}</label>
            <div className="flex flex-wrap items-center gap-3">
              {recording ? <Button variant="destructive" onClick={() => void stop()}><SquareIcon />{tz("结束并生成纪要 ·")} {mm}</Button> : <Button onClick={() => void start()} disabled={busy || !consent}><MicIcon />{tz("开始录音")}</Button>}
              <Button asChild variant="outline" disabled={busy}><label className={busy ? "pointer-events-none opacity-50" : "cursor-pointer"}><UploadIcon />{tz("上传录音")}<input type="file" accept="audio/*" className="hidden" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
              {stage && <span className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin" />{stage}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{tz("录音时请保持本页面打开；切到后台或锁屏可能会中断。长会议会自动分段转写，单个上传文件不超过 20MB。")}</p>
          </div>}
        </main>
      </div>
    </div>
  </div>;
}

function MeetingDetail({ meeting, onDeleted }: { meeting: MeetingRow; onDeleted: () => void }) {
  const saveBrain = useServerFn(saveMeetingToBrain);
  const remove = useServerFn(deleteMeeting);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const s = meeting.summary;
  const [picked, setPicked] = useState<number[]>(() => s.actions.map((_, i) => i));
  const [target, setTarget] = useState<DispatchTarget>("jira");
  const [busy, setBusy] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  useEffect(() => { setPicked(s.actions.map((_, i) => i)); }, [meeting.id, s.actions]);

  const toBrain = async () => {
    setBusy("brain");
    try { await saveBrain({ data: { id: meeting.id } }); await qc.invalidateQueries({ queryKey: ["meetings"] }); toast.success(tz("已存入 Smart Brain，之后可直接向 Bot 提问这次会议")); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("保存失败")); } finally { setBusy(""); }
  };
  const dispatch = async () => {
    const actions = s.actions.filter((_, i) => picked.includes(i));
    if (!actions.length) return;
    setBusy("dispatch");
    try {
      const id = await createThread();
      sessionStorage.setItem(pendingKey(id), JSON.stringify({ text: buildDispatchPrompt(target, meeting.title, actions), files: [] }));
      void qc.invalidateQueries({ queryKey: ["threads"] });
      await navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch { toast.error(tz("无法发起派发，请重试")); setBusy(""); }
  };
  const del = async () => {
    if (!confirm(tz("删除这条会议记录？（已存入 Smart Brain 的文档不受影响）"))) return;
    try { await remove({ data: { id: meeting.id } }); await qc.invalidateQueries({ queryKey: ["meetings"] }); onDeleted(); } catch { toast.error(tz("删除失败")); }
  };

  return <article className="flex flex-col gap-5 rounded-lg border border-border p-5">
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold">{meeting.title}</h2><p className="text-xs text-muted-foreground">{new Date(meeting.started_at ?? meeting.created_at).toLocaleString("zh-CN")}</p></div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={() => void toBrain()} disabled={Boolean(busy) || Boolean(meeting.brain_document_id)}>{busy === "brain" ? <LoaderCircleIcon className="animate-spin" /> : <BrainCircuitIcon />}{meeting.brain_document_id ? tz("已存入 Brain") : tz("存入 Smart Brain")}</Button>
        <Button size="icon" variant="ghost" aria-label={tz("删除")} onClick={() => void del()}><Trash2Icon /></Button>
      </div>
    </header>
    <section><h3 className="mb-1 text-sm font-medium">{tz("概要")}</h3><p className="text-sm leading-relaxed text-muted-foreground">{s.overview}</p></section>
    {s.topics.length > 0 && <section className="flex flex-col gap-2"><h3 className="text-sm font-medium">{tz("议题")}</h3>{s.topics.map((t, i) => <div key={i}><div className="text-sm">{t.title}</div><ul className="ml-4 list-disc text-sm text-muted-foreground">{t.points.map((p, j) => <li key={j}>{p}</li>)}</ul></div>)}</section>}
    <section><h3 className="mb-1 text-sm font-medium">{tz("决议")}</h3>{s.decisions.length ? <ul className="ml-4 list-disc text-sm text-muted-foreground">{s.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul> : <p className="text-sm text-muted-foreground">{tz("无明确决议")}</p>}</section>
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{tz("待办")}</h3>
      {s.actions.length === 0 ? <p className="text-sm text-muted-foreground">{tz("没有提取到待办")}</p> : <>
        {s.actions.map((a, i) => <label key={i} className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={picked.includes(i)} onCheckedChange={(v) => setPicked((p) => v === true ? [...p, i] : p.filter((x) => x !== i))} /><span>{a.task}<span className="text-muted-foreground">{a.owner ? ` · ${a.owner}` : ""}{a.due ? ` · ${a.due}` : ""}</span></span></label>)}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select value={target} onChange={(e) => setTarget(e.target.value as DispatchTarget)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">{DISPATCH_TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          <Button size="sm" onClick={() => void dispatch()} disabled={Boolean(busy) || picked.length === 0}>{busy === "dispatch" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}{tz("派发选中待办")}</Button>
          <span className="text-xs text-muted-foreground">{tz("将在新对话中逐条确认后创建")}</span>
        </div>
      </>}
    </section>
    <section><button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowTranscript((v) => !v)}>{showTranscript ? tz("收起逐字稿") : tz("查看逐字稿")}</button>
      {showTranscript && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">{meeting.transcript}</pre>}</section>
  </article>;
}
