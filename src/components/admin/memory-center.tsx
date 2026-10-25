import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMemory, memoryAction, type MemoryVersion } from "@/lib/memory.functions";
import { buildMemoryContext, MEMORY_MAX, type MemoryKind } from "@/lib/memory";
import { cn } from "@/lib/utils";

const LABEL: Record<MemoryKind, string> = { identity: "核心身份记忆", knowledge: "产品与公司知识库" };
const HINT: Record<MemoryKind, string> = {
  identity: "Oxford Bot 是谁、说话风格、必须坚持的原则。每次对话都会注入。",
  knowledge: "产品功能、价格、公司信息、常见问题等事实资料。",
};
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("zh-CN", { hour12: false }) : "—");

export function MemoryCenter() {
  const list = useServerFn(listMemory);
  const act = useServerFn(memoryAction);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-memory"], queryFn: () => list() });
  const [kind, setKind] = useState<MemoryKind>("identity");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const versions = ((q.data ?? []) as MemoryVersion[]).filter((v) => v.kind === kind);
  const live = versions.find((v) => v.published);

  useEffect(() => { setText(live?.content ?? versions[0]?.content ?? ""); setNote(""); setPreview(false); }, [kind, q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation({
    mutationFn: (a: Parameters<typeof act>[0]["data"]) => act({ data: a }),
    onSuccess: () => { toast.success("已保存"); void qc.invalidateQueries({ queryKey: ["admin-memory"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-xl border border-border p-4">
        <div className="flex gap-2">
          {(["identity", "knowledge"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn("rounded-lg px-3 py-1.5 text-sm", kind === k ? "bg-secondary" : "text-muted-foreground hover:text-foreground")}>{LABEL[k]}</button>
          ))}
          <span className="ml-auto self-center text-xs text-muted-foreground">{live ? `线上版本：${fmt(live.publishedAt)}` : "未发布"}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{HINT[kind]} 优先级：用户指令 &gt; 安全规则 &gt; 核心身份 &gt; 知识库。</p>
        {preview ? (
          <pre className="mt-3 max-h-[420px] min-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 font-mono text-xs">{buildMemoryContext({ [kind]: text }).trim() || "（空）"}</pre>
        ) : (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MEMORY_MAX} className="mt-3 min-h-[320px] font-mono text-sm" placeholder={`填写${LABEL[kind]}…`} />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="版本备注（可选）" className="h-9 max-w-xs" />
          <span className="text-xs text-muted-foreground">{text.length}/{MEMORY_MAX}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>{preview ? "继续编辑" : "预览注入效果"}</Button>
            <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate({ type: "save", kind, content: text, note, publish: false })}>存为草稿</Button>
            <Button size="sm" disabled={m.isPending || !text.trim()} onClick={() => m.mutate({ type: "save", kind, content: text, note, publish: true })}>保存并发布</Button>
          </div>
        </div>
      </section>
      <aside className="rounded-xl border border-border">
        <div className="flex items-center border-b border-border px-4 py-3 text-sm font-medium">
          版本历史
          {live && <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" disabled={m.isPending} onClick={() => m.mutate({ type: "unpublish", kind })}>停用线上版本</Button>}
        </div>
        <div className="max-h-[480px] divide-y divide-border overflow-auto">
          {q.isLoading && <p className="p-4 text-sm text-muted-foreground">加载中…</p>}
          {versions.map((v: MemoryVersion) => (
            <div key={v.id} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{fmt(v.createdAt)}</span>
                {v.published && <span className="rounded bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">线上</span>}
              </div>
              {v.note && <p className="mt-1 text-xs">{v.note}</p>}
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.content}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setText(v.content)}>载入编辑</Button>
                {!v.published && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={m.isPending} onClick={() => m.mutate({ type: "publish", id: v.id })}>发布此版本</Button>}
              </div>
            </div>
          ))}
          {!q.isLoading && versions.length === 0 && <p className="p-4 text-sm text-muted-foreground">暂无版本</p>}
        </div>
      </aside>
    </div>
  );
}
