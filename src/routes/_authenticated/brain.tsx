import { tz } from "@/lib/i18n";
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
import { addBrainDocument, browseBrainSource, deleteBrainDocument, getBrain, importBrainSource, setBrainEnabled } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/brain")({
  head: () => ({
    meta: [
      { title: "Smart Brain · Oxford Bot" },
      { name: "description", content: tz("Oxford Bot Smart Brain：上传私人文档，打造只属于你的 RAG 知识大脑。") },
      { property: "og:title", content: "Smart Brain · Oxford Bot" },
      { property: "og:description", content: tz("上传私人文档，Bot 回答时自动检索并标注来源。") },
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
    if (file.size > 10 * 1024 * 1024) { toast.error(tz("单个文件不超过 10MB")); return; }
    setBusy(file.name);
    try {
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 200);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        await add({ data: { title: name, pdfBase64: btoa(bin) } });
      } else if (TEXT_TYPES.test(file.name) || file.type.startsWith("text/")) {
        await add({ data: { title: name, text: await file.text() } });
      } else throw new Error(tz("支持 PDF、TXT、Markdown、CSV、JSON"));
      toast.success(tz("《{0}》已加入 Smart Brain", name));
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : tz("上传失败")); }
    finally { setBusy(""); }
  }

  async function savePaste() {
    if (!title.trim() || !text.trim()) { toast.error(tz("请填写标题和内容")); return; }
    setBusy("paste");
    try { await add({ data: { title: title.trim(), text } }); setTitle(""); setText(""); toast.success(tz("已加入 Smart Brain")); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("保存失败")); }
    finally { setBusy(""); }
  }

  const docs = data?.docs ?? [];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/chat" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />{tz("返回对话")}</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><BrainCircuitIcon className="size-6" />Smart Brain</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tz("你的私人知识大脑。上传资料后，所有 Bot 回答时会自动检索并注明来源；内容只对你本人可见。")}</p>
          </div>
          {data && <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{tz("启用")}<Switch checked={data.brain.enabled} onCheckedChange={async v => { await toggle({ data: { enabled: v } }); refresh(); }} aria-label={tz("启用 Smart Brain")} /></label>}
        </div>

        <section className="mt-8 rounded-lg border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{tz("上传文档")} <span className="text-muted-foreground">· PDF / TXT / Markdown / CSV / JSON</span></p>
            <span className="font-mono text-xs text-muted-foreground">{docs.length} / {data?.limit ?? "–"} {tz("份")}{data && !data.pro ? tz(" · 升级 Pro 可存 100 份") : ""}</span>
          </div>
          <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,.markdown,.csv,.json,application/pdf,text/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          <Button className="mt-4" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
            {busy && busy !== "paste" ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}{busy && busy !== "paste" ? tz("解析并建立索引中…") : tz("选择文件")}
          </Button>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm text-muted-foreground">{tz("或直接粘贴文字")}</summary>
            <Input className="mt-3" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder={tz("文档标题")} />
            <Textarea className="mt-2 min-h-40" value={text} onChange={e => setText(e.target.value)} placeholder={tz("粘贴内容…")} />
            <Button className="mt-2" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void savePaste()}>{busy === "paste" && <LoaderCircleIcon className="animate-spin" />}{tz("保存到 Smart Brain")}</Button>
          </details>
        </section>

        <SourceImport onImported={refresh} />

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium">{tz("我的文档")}</h2>
          {isLoading ? <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" /> : docs.length === 0 ? <p className="text-sm text-muted-foreground">{tz("还没有文档。上传第一份资料，让 Oxford Bot 记住它。")}</p> :
            <ul className="divide-y divide-border rounded-lg border border-border">
              {docs.map(d => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{d.title}</p><p className="font-mono text-xs text-muted-foreground">{d.chars.toLocaleString()} {tz("字 ·")} {d.chunk_count} {tz("段 ·")} {new Date(d.created_at).toLocaleDateString()}</p></div>
                  <Button variant="ghost" size="icon-sm" aria-label={tz("删除 {0}", d.title)} onClick={async () => { if (!window.confirm(tz("删除《{0}》？", d.title))) return; await del({ data: { id: d.id } }); refresh(); }}><Trash2Icon /></Button>
                </li>
              ))}
            </ul>}
        </section>
      </div>
    </div>
  );
}

type Source = "google_drive" | "notion" | "yuque";
const SOURCES: { id: Source; label: string }[] = [{ id: "google_drive", label: tz("Google 云盘") }, { id: "notion", label: "Notion" }, { id: "yuque", label: tz("语雀") }];

function SourceImport({ onImported }: { onImported: () => void }) {
  const browse = useServerFn(browseBrainSource);
  const importDoc = useServerFn(importBrainSource);
  const [source, setSource] = useState<Source>("google_drive");
  const [query, setQuery] = useState("");
  const [repo, setRepo] = useState<{ id: string; title: string } | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof browseBrainSource>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState("");
  const [done, setDone] = useState<string[]>([]);

  async function load(nextRepo = repo) {
    setLoading(true);
    try { setResult(await browse({ data: { source, query, repo: nextRepo?.id } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("读取失败")); }
    finally { setLoading(false); }
  }
  function pick(s: Source) { setSource(s); setRepo(null); setResult(null); setQuery(""); }
  async function add(item: { id: string; title: string }) {
    if (!window.confirm(tz("把《{0}》导入 Smart Brain？之后可随时在下方删除。", item.title))) return;
    setImporting(item.id);
    try { await importDoc({ data: { source, id: item.id, repo: repo?.id, title: item.title.slice(0, 180) } }); setDone((d) => [...d, item.id]); toast.success(tz("《{0}》已导入", item.title)); onImported(); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("导入失败")); }
    finally { setImporting(""); }
  }

  return <section className="mt-6 rounded-lg border border-border p-5">
    <p className="text-sm">{tz("从已连接的工具导入")} <span className="text-muted-foreground">{tz("· 只导入你勾选的资料")}</span></p>
    <div className="mt-3 flex flex-wrap gap-2">{SOURCES.map((s) => <Button key={s.id} size="sm" variant={source === s.id ? "secondary" : "outline"} onClick={() => pick(s.id)}>{s.label}</Button>)}</div>
    <div className="mt-3 flex gap-2">
      {source !== "yuque" && <Input value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder={source === "google_drive" ? tz("输入文件名或关键词") : tz("输入页面标题关键词（可留空）")} />}
      {source === "yuque" && repo && <Button size="sm" variant="ghost" onClick={() => { setRepo(null); void load(null); }}>{tz("← 知识库列表")}</Button>}
      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>{loading && <LoaderCircleIcon className="animate-spin" />}{source === "yuque" ? (repo ? tz("刷新《{0}》", repo.title) : tz("列出知识库")) : tz("搜索")}</Button>
    </div>
    {result && !result.connected && <p className="mt-3 text-sm text-muted-foreground">{tz("还没有连接这个工具。请先在对话页的「工具与连接」里完成授权。")}</p>}
    {result?.connected && (result.items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{source === "google_drive" && !query.trim() ? tz("请输入关键词搜索") : tz("没有找到资料")}</p> :
      <ul className="mt-3 max-h-72 divide-y divide-border overflow-auto rounded-md border border-border">{result.items.map((i) => <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
        <div className="min-w-0 flex-1"><p className="truncate">{i.title}</p>{i.detail && <p className="truncate text-xs text-muted-foreground">{i.detail}</p>}</div>
        {i.kind === "repo" ? <Button size="sm" variant="ghost" onClick={() => { const r = { id: i.id, title: i.title }; setRepo(r); void load(r); }}>{tz("打开")}</Button> :
          <Button size="sm" variant="outline" disabled={Boolean(importing) || done.includes(i.id)} onClick={() => void add(i)}>{importing === i.id && <LoaderCircleIcon className="animate-spin" />}{done.includes(i.id) ? tz("已导入") : tz("导入")}</Button>}
      </li>)}</ul>)}
  </section>;
}
