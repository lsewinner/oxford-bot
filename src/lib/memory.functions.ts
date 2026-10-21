import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEMORY_MAX } from "@/lib/memory";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(c: Ctx) {
  const { data } = await c.supabase.rpc("has_role", { _user_id: c.userId, _role: "admin" });
  if (data !== true) throw new Error("无管理员权限");
}

export type MemoryVersion = { id: string; kind: "identity" | "knowledge"; content: string; note: string | null; published: boolean; createdAt: string; publishedAt: string | null };

export const listMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await (context.supabase as any).from("oxford_memory_versions").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("读取记忆失败");
    return (data ?? []).map((r: any): MemoryVersion => ({ id: r.id, kind: r.kind, content: r.content, note: r.note, published: r.published, createdAt: r.created_at, publishedAt: r.published_at }));
  });

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("save"), kind: z.enum(["identity", "knowledge"]), content: z.string().max(MEMORY_MAX), note: z.string().max(200).optional(), publish: z.boolean() }),
  z.object({ type: z.literal("publish"), id: z.string().uuid() }),
  z.object({ type: z.literal("unpublish"), kind: z.enum(["identity", "knowledge"]) }),
]);

export const memoryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof schema>) => schema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = context.supabase as any;
    const clear = async (kind: string) => {
      const { error } = await sb.from("oxford_memory_versions").update({ published: false }).eq("kind", kind).eq("published", true);
      if (error) throw new Error("发布失败");
    };
    if (data.type === "save") {
      if (data.publish) await clear(data.kind);
      const { error } = await sb.from("oxford_memory_versions").insert({ kind: data.kind, content: data.content, note: data.note || null, created_by: context.userId, published: data.publish, published_at: data.publish ? new Date().toISOString() : null });
      if (error) throw new Error("保存失败");
    } else if (data.type === "publish") {
      const { data: row } = await sb.from("oxford_memory_versions").select("kind").eq("id", data.id).single();
      if (!row) throw new Error("版本不存在");
      await clear(row.kind);
      const { error } = await sb.from("oxford_memory_versions").update({ published: true, published_at: new Date().toISOString() }).eq("id", data.id);
      if (error) throw new Error("发布失败");
    } else await clear(data.kind);
    await sb.from("admin_audit_log").insert({ admin_id: context.userId, target_user_id: null, action: `memory_${data.type}`, details: { kind: "kind" in data ? data.kind : undefined } });
    return { ok: true };
  });
