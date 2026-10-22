import { BRAIN_EMBED_MODEL, type BrainHit } from "./brain";

export async function embedTexts(input: string[]): Promise<number[][]> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("AI 服务未配置");
  const out: number[][] = [];
  for (let i = 0; i < input.length; i += 32) {
    const batch = input.slice(i, i + 32);
    let res: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: BRAIN_EMBED_MODEL, input: batch }),
      });
      if (res.ok || !(res.status === 429 || res.status >= 500) || attempt === 3) break;
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 500));
    }
    if (!res!.ok) {
      if (res!.status === 402) throw new Error("AI 额度不足，暂时无法建立索引");
      throw new Error(`向量化失败（${res!.status}）`);
    }
    const json = (await res!.json()) as { data: { index: number; embedding: number[] }[] };
    const ordered: number[][] = [];
    for (const d of json.data) ordered[d.index] = d.embedding;
    if (ordered.length !== batch.length || ordered.some((v) => !v?.length)) throw new Error("向量结果不完整");
    out.push(...ordered);
  }
  return out;
}

export async function extractPdfText(base64: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

/** Retrieves the caller's own chunks; userId must already be verified. */
export async function searchBrain(userId: string, query: string): Promise<BrainHit[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("brain_chunks").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) return [];
  const [vec] = await embedTexts([query.slice(0, 4000)]);
  const { data, error } = await supabaseAdmin.rpc("match_brain_chunks", { p_user: userId, query_embedding: JSON.stringify(vec), match_count: 6 } as never);
  if (error) throw error;
  return ((data ?? []) as BrainHit[]);
}

/** Chunks, embeds and stores one text document for an already-verified user (quota enforced). */
export async function ingestBrainText(supabase: any, userId: string, title: string, text: string) {
  const { BRAIN_FREE_DOCS, BRAIN_PRO_DOCS, BRAIN_MAX_CHARS, chunkText } = await import("./brain");
  const { isProUser } = await import("./pro.server");
  const limit = (await isProUser(supabase as never, userId)) ? BRAIN_PRO_DOCS : BRAIN_FREE_DOCS;
  const { count } = await supabase.from("brain_documents").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= limit) throw new Error(limit === BRAIN_FREE_DOCS ? `免费账户最多 ${limit} 份文档，升级 Pro 可存 ${BRAIN_PRO_DOCS} 份` : `最多 ${limit} 份文档`);
  let { data: brain } = await supabase.from("smart_brains").select("id").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  if (!brain) ({ data: brain } = await supabase.from("smart_brains").insert({ user_id: userId }).select("id").single());
  if (!brain) throw new Error("创建 Smart Brain 失败");
  const body = text.slice(0, BRAIN_MAX_CHARS);
  const chunks = chunkText(body);
  if (!chunks.length) throw new Error("没有可保存的文字");
  const vectors = await embedTexts(chunks);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: doc, error } = await supabaseAdmin.from("brain_documents").insert({ brain_id: brain.id, user_id: userId, title, chars: body.length, chunk_count: chunks.length }).select("id").single();
  if (error || !doc) throw new Error("保存文档失败");
  const rows = chunks.map((content, idx) => ({ document_id: doc.id, brain_id: brain.id, user_id: userId, idx, content, embedding: JSON.stringify(vectors[idx]) }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: e } = await supabaseAdmin.from("brain_chunks").insert(rows.slice(i, i + 100) as never);
    if (e) { await supabaseAdmin.from("brain_documents").delete().eq("id", doc.id); throw new Error("保存索引失败"); }
  }
  return doc.id as string;
}
