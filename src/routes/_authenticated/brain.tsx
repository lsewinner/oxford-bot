import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, BrainCircuitIcon, FileTextIcon, LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { addBrainDocument, deleteBrainDocument, getBrain, setBrainEnabled } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/brain")({
  head: () => ({
    meta: [
      { title: "Smart Brain · Oxford Bot" },
      { name: "description", content: "Oxford Smart Brain：上传私人文档，打造只属于你的 RAG 知识大脑。" },
      { property: "og:title", content: "Smart Brain · Oxford Bot" },
      { property: "og:description", content: "上传私人文档，Bot 回答时自动检索并标注来源。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrainPage,
});

const TEXT_TYPES = /\.(txt|md|markdown|csv|json)$/i;

function BrainPage() {
  const fetchBrain = useServerFn(getBrain);
  const add = useServerFn(addBrainDocument);
  const del = useServerFn(deleteBrainDocument);
  const toggle = useServerFn(setBrainEnabled);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["smart-brain"], queryFn: () => fetchBrain() });
  const [busy, setBusy] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["smart-brain"] });

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error("单个文件不超过 10MB"); return; }
    setBusy(file.name);
    try {
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 200);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        await add({ data: { title: name, pdfBase64: btoa(bin) } });
      } else if (TEXT_TYPES.test(file.name) || file.type.startsWith("text/")) {
        await add({ data: { title: name, text: await file.text() } });
      } else throw new Error("支持 PDF、TXT、Markdown、CSV、JSON");
      toast.success(`《${name}》已加入 Smart Brain`);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "上传失败"); }
    finally { setBusy(""); }
  }

  async function savePaste() {
    if (!title.trim() || !text.trim()) { toast.error("请填写标题和内容"); return; }
    setBusy("paste");
    try { await add({ data: { title: title.trim(), text } }); setTitle(""); setText(""); toast.success("已加入 Smart Brain"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
    finally { setBusy(""); }
  }

  const docs = data?.docs ?? [];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/chat" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />返回对话</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><BrainCircuitIcon className="size-6" />Smart Brain</h1>
            <p className="mt-2 text-sm text-muted-foreground">你的私人知识大脑。上传资料后，所有 Bot 回答时会自动检索并注明来源；内容只对你本人可见。</p>
          </div>
          {data && <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">启用<Switch checked={data.brain.enabled} onCheckedChange={async v => { await toggle({ data: { enabled: v } }); refresh(); }} aria-label="启用 Smart Brain" /></label>}
        </div>

        <section className="mt-8 rounded-lg border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">上传文档 <span className="text-muted-foreground">· PDF / TXT / Markdown / CSV / JSON</span></p>
            <span className="font-mono text-xs text-muted-foreground">{docs.length} / {data?.limit ?? "–"} 份{data && !data.pro ? " · 升级 Pro 可存 100 份" : ""}</span>
          </div>
          <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,.markdown,.csv,.json,application/pdf,text/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          <Button className="mt-4" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
            {busy && busy !== "paste" ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}{busy && busy !== "paste" ? "解析并建立索引中…" : "选择文件"}
          </Button>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm text-muted-foreground">或直接粘贴文字</summary>
            <Input className="mt-3" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="文档标题" />
            <Textarea className="mt-2 min-h-40" value={text} onChange={e => setText(e.target.value)} placeholder="粘贴内容…" />
            <Button className="mt-2" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void savePaste()}>{busy === "paste" && <LoaderCircleIcon className="animate-spin" />}保存到 Smart Brain</Button>
          </details>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium">我的文档</h2>
          {isLoading ? <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" /> : docs.length === 0 ? <p className="text-sm text-muted-foreground">还没有文档。上传第一份资料，让 Oxford 记住它。</p> :
            <ul className="divide-y divide-border rounded-lg border border-border">
              {docs.map(d => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{d.title}</p><p className="font-mono text-xs text-muted-foreground">{d.chars.toLocaleString()} 字 · {d.chunk_count} 段 · {new Date(d.created_at).toLocaleDateString()}</p></div>
                  <Button variant="ghost" size="icon-sm" aria-label={`删除 ${d.title}`} onClick={async () => { if (!window.confirm(`删除《${d.title}》？`)) return; await del({ data: { id: d.id } }); refresh(); }}><Trash2Icon /></Button>
                </li>
              ))}
            </ul>}
        </section>
      </div>
    </div>
  );
}
