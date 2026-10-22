import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BRAIN_FREE_DOCS, BRAIN_MAX_CHARS, BRAIN_PRO_DOCS, chunkText } from "./brain";

async function ensureBrain(supabase: any, userId: string) {
  const { data } = await supabase.from("smart_brains").select("id,name,enabled").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  if (data) return data as { id: string; name: string; enabled: boolean };
  const { data: created, error } = await supabase.from("smart_brains").insert({ user_id: userId }).select("id,name,enabled").single();
  if (error) throw new Error("创建 Smart Brain 失败");
  return created as { id: string; name: string; enabled: boolean };
}

export const getBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const brain = await ensureBrain(context.supabase, context.userId);
    const { data: docs } = await context.supabase.from("brain_documents").select("id,title,chars,chunk_count,created_at").eq("brain_id", brain.id).order("created_at", { ascending: false });
    const { isProUser } = await import("./pro.server");
    const pro = await isProUser(context.supabase as never, context.userId);
    return { brain, docs: docs ?? [], limit: pro ? BRAIN_PRO_DOCS : BRAIN_FREE_DOCS, pro };
  });

export const setBrainEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const brain = await ensureBrain(context.supabase, context.userId);
    await context.supabase.from("smart_brains").update({ enabled: data.enabled, updated_at: new Date().toISOString() }).eq("id", brain.id);
    return { ok: true };
  });

export const addBrainDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(200),
    text: z.string().max(BRAIN_MAX_CHARS).optional(),
    pdfBase64: z.string().max(14_000_000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brain = await ensureBrain(supabase, userId);
    const { isProUser } = await import("./pro.server");
    const limit = (await isProUser(supabase as never, userId)) ? BRAIN_PRO_DOCS : BRAIN_FREE_DOCS;
    const { count } = await supabase.from("brain_documents").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= limit) throw new Error(limit === BRAIN_FREE_DOCS ? `免费账户最多 ${limit} 份文档，升级 Pro 可存 ${BRAIN_PRO_DOCS} 份` : `最多 ${limit} 份文档`);
    const server = await import("./brain.server");
    let text = data.text ?? "";
    if (data.pdfBase64) {
      try { text = await server.extractPdfText(data.pdfBase64); } catch { throw new Error("PDF 解析失败，请确认文件未加密"); }
    }
    text = text.slice(0, BRAIN_MAX_CHARS);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("没有可提取的文字（扫描版 PDF 暂不支持）");
    const vectors = await server.embedTexts(chunks);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin.from("brain_documents").insert({ brain_id: brain.id, user_id: userId, title: data.title, chars: text.length, chunk_count: chunks.length }).select("id").single();
    if (error || !doc) throw new Error("保存文档失败");
    const rows = chunks.map((content, idx) => ({ document_id: doc.id, brain_id: brain.id, user_id: userId, idx, content, embedding: JSON.stringify(vectors[idx]) }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error: e } = await supabaseAdmin.from("brain_chunks").insert(rows.slice(i, i + 100) as never);
      if (e) { await supabaseAdmin.from("brain_documents").delete().eq("id", doc.id); throw new Error("保存索引失败"); }
    }
    return { id: doc.id, chunks: chunks.length };
  });

export const deleteBrainDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brain_documents").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("删除失败");
    return { ok: true };
  });

const BRAIN_SOURCES = { google_drive: "Google 云盘", notion: "Notion", yuque: "语雀" } as const;
const sourceId = z.enum(["google_drive", "notion", "yuque"]);

/** Read-only browse of the caller's own connected source; nothing is imported until they pick an item. */
export const browseBrainSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ source: sourceId, query: z.string().max(200).default(""), repo: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getConnection } = await import("./connections/storage.server");
    if (!(await getConnection(context.userId, data.source))) return { connected: false, items: [] as { title: string; id: string; detail: string; kind: "doc" | "repo" }[] };
    const { executeOperation } = await import("./connections/execute.server");
    const yuqueRepos = data.source === "yuque" && !data.repo;
    if (data.source === "google_drive" && !data.query.trim()) return { connected: true, items: [] };
    const op = data.source === "yuque" ? (yuqueRepos ? { operation: "repos" } : { operation: "docs", repo: data.repo }) : { operation: "search", query: data.query };
    const r = await executeOperation(context.userId, data.source, op as never);
    if (r.status !== "completed") throw new Error(r.summary || "读取失败，请到「工具与连接」检查授权");
    return { connected: true, items: (r.items ?? []).filter((i) => i.id).slice(0, 50).map((i) => ({ title: i.title, id: i.id!, detail: i.detail ?? "", kind: (yuqueRepos ? "repo" : "doc") as "doc" | "repo" })) };
  });

export const importBrainSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ source: sourceId, id: z.string().min(1).max(200), repo: z.string().max(200).optional(), title: z.string().trim().min(1).max(180) }).parse(d))
  .handler(async ({ data, context }) => {
    const { executeOperation } = await import("./connections/execute.server");
    const r = await executeOperation(context.userId, data.source, { operation: "read", id: data.id, ...(data.repo ? { repo: data.repo } : {}) } as never);
    if (r.status !== "completed") throw new Error(r.summary || "读取失败");
    const text = (r.text ?? "").trim();
    if (text.length < 20) throw new Error("这份资料没有可导入的正文");
    const { ingestBrainText } = await import("./brain.server");
    const documentId = await ingestBrainText(context.supabase, context.userId, `${BRAIN_SOURCES[data.source]} · ${data.title}`, text.slice(0, BRAIN_MAX_CHARS));
    return { documentId };
  });
