import { DownloadIcon, FileTextIcon, MaximizeIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";
import { Textarea } from "@/components/ui/textarea";

export function MediaCard({ url, filename = "Oxford-Bot-image.png" }: { url: string; filename?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="my-3 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card">
    <Button variant="ghost" className="block h-auto w-full rounded-none p-0" aria-label="放大查看图片" onClick={() => setOpen(true)}>
      <img src={url} alt={filename} className="max-h-[32rem] w-full object-contain" />
    </Button>
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="min-w-0 truncate text-xs text-muted-foreground">{filename}</span>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" aria-label="放大查看图片" title="放大查看" onClick={() => setOpen(true)}><MaximizeIcon className="size-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="下载图片" title="下载图片" asChild><a href={url} download={filename}><DownloadIcon className="size-4" /></a></Button>
      </div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92dvh] max-w-5xl overflow-auto"><DialogTitle className="truncate pr-6">{filename}</DialogTitle><img src={url} alt={filename} className="max-h-[75dvh] w-full object-contain" /></DialogContent></Dialog>
  </div>;
}

export function FileAttachment({ url, mediaType, filename }: { url: string; mediaType: string; filename?: string }) {
  if (mediaType.startsWith("image/")) return <MediaCard url={url} {...(filename ? { filename } : {})} />;
  return <a href={url} download={filename ?? "document"} className="my-2 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-foreground"><FileTextIcon className="size-6 shrink-0 text-muted-foreground" /><span className="min-w-0 truncate text-sm">{filename ?? "附件"}</span><DownloadIcon className="ml-auto size-4 shrink-0" /></a>;
}

export function GeneratedImage({ prompt, image, autoStart, onComplete }: { prompt: string; image?: string; autoStart: boolean; onComplete: (url: string, prompt: string) => void }) {
  const [frame, setFrame] = useState(image);
  const [final, setFinal] = useState(Boolean(image));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const lastSuccess = useRef(image);
  async function generate(nextPrompt = prompt, explicit = false) {
    if (explicit && !loading) started.current = false;
    if (started.current) return;
    started.current = true;
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      let finishedImage: string | undefined;
      await streamImage("/api/generate-image", { prompt: nextPrompt }, (url, done) => {
        setFrame(url); setFinal(done);
        if (done) finishedImage = url;
      }, undefined, headers);
      if (finishedImage) { lastSuccess.current = finishedImage; complete.current(finishedImage, nextPrompt); setEditing(false); }
    } catch (err) {
      const message = err instanceof Error ? err.message : "图片生成失败";
      setError(message); setFrame(lastSuccess.current); setFinal(Boolean(lastSuccess.current)); toast.error(message);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (autoStart && !image) void generate(); }, [autoStart, image]);
  return <div className="my-3 w-full max-w-lg">
    {frame && final && !loading && <div className="image-reveal"><MediaCard url={frame} filename="Oxford-Bot-generated.png" /></div>}
    {loading ? <div className="image-generating relative aspect-square overflow-hidden rounded-lg border border-border bg-card" aria-label="正在生成图片">
      {frame && <img src={frame} alt="生成中的图片预览" className="h-full w-full object-contain blur-2xl transition-[filter] duration-700" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground"><SparklesIcon className="size-7" /><span className="text-sm">正在绘制…</span><div className="image-progress h-1 w-32 overflow-hidden rounded-full bg-secondary"><span className="block h-full w-1/3 bg-primary" /></div></div>
    </div> : error ? <p role="alert" className="rounded-lg border border-border p-4 text-sm text-destructive">{error}</p> : !frame && <Button variant="outline" onClick={() => void generate()}><SparklesIcon className="size-4" />生成图片</Button>}
    {!loading && (lastSuccess.current || error) && !editing && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><PencilIcon className="size-4" />修改提示词</Button>}
    {editing && <div className="mt-3 space-y-2">
      <Textarea aria-label="图片提示词" value={draft} onChange={e => setDraft(e.target.value)} maxLength={8000} disabled={loading} className="min-h-24 resize-y" />
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" disabled={loading} onClick={() => { setEditing(false); setDraft(prompt); }}>取消</Button><Button size="sm" disabled={loading || !draft.trim()} onClick={() => void generate(draft.trim(), true)}><SparklesIcon className="size-4" />重新生成图片</Button></div>
    </div>}
  </div>;
}