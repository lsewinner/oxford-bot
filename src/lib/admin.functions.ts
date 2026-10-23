import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paidPlanForPrice } from "@/lib/pro";
import { serverPaymentsEnv } from "@/lib/stripe.server";
import { effectiveDailyLimit, type Tier } from "@/lib/quota";

type Ctx = { supabase: any; userId: string };

async function requireAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("无管理员权限");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type AdminUserRow = { id: string; email: string; nickname: string; createdAt: string; lastSignIn: string | null; paidPro: boolean; paidUltra: boolean; grantedPro: boolean; proUntil: string | null; isPro: boolean; tier: Tier; grantedTier: "pro" | "ultra" | null; banned: boolean; dailyLimitOverride: number | null; dailyLimit: number; usedToday: number };
export type AdminAuditRow = { id: string; action: string; details: Record<string, unknown> | null; createdAt: string; target: string | null; admin: string };

const today = () => new Date().toISOString().slice(0, 10);

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });

export const loadAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context as Ctx);
    const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error("读取用户失败");
    const [{ data: controls }, { data: usage }, { data: subs }, { data: audit }] = await Promise.all([
      admin.from("account_controls").select("*"),
      admin.from("usage_daily").select("user_id,count").eq("day", today()),
      admin.from("subscriptions").select("user_id,status,current_period_end,price_id").eq("environment", serverPaymentsEnv() ?? "unconfigured"),
      admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const now = Date.now();
    const ctl = new Map((controls ?? []).map((c: any) => [c.user_id, c]));
    const used = new Map((usage ?? []).map((u: any) => [u.user_id, u.count as number]));
    const activeSubs = (subs ?? []).filter((s: any) => {
      const end = s.current_period_end ? Date.parse(s.current_period_end) : null;
      return (["active", "trialing", "past_due"].includes(s.status) && (end === null || end > now)) || (s.status === "canceled" && end !== null && end > now);
    });
    const paidUltra = new Set(activeSubs.filter((s: any) => paidPlanForPrice(s.price_id) === "ultra").map((s: any) => s.user_id));
    const paid = new Set((subs ?? []).filter((s: any) => {
      const end = s.current_period_end ? Date.parse(s.current_period_end) : null;
      return (["active", "trialing", "past_due"].includes(s.status) && (end === null || end > now)) || (s.status === "canceled" && end !== null && end > now);
    }).map((s: any) => s.user_id));
    const emails = new Map<string, string>();
    const users: AdminUserRow[] = list.users.map((u: any): AdminUserRow => {
      const c: any = ctl.get(u.id);
      const granted = Boolean(c?.pro_granted && (!c.pro_until || Date.parse(c.pro_until) > now));
      const isPro = paid.has(u.id) || granted;
      const grantedTier = granted ? ((c?.granted_tier === "ultra" ? "ultra" : "pro") as "pro" | "ultra") : null;
      const tier: Tier = grantedTier === "ultra" || paidUltra.has(u.id) ? "ultra" : paid.has(u.id) ? "paid_pro" : isPro ? "pro" : "free";
      emails.set(u.id, u.email ?? "");
      return {
        id: u.id as string,
        email: (u.email ?? "") as string,
        nickname: (u.user_metadata?.nickname ?? "") as string,
        createdAt: u.created_at as string,
        lastSignIn: (u.last_sign_in_at ?? null) as string | null,
        paidPro: paid.has(u.id),
        paidUltra: paidUltra.has(u.id),
        grantedPro: granted,
        proUntil: (c?.pro_granted ? c.pro_until : null) as string | null,
        isPro,
        tier,
        grantedTier,
        banned: Boolean(c?.banned),
        dailyLimitOverride: (c?.daily_limit ?? null) as number | null,
        dailyLimit: effectiveDailyLimit(c?.daily_limit, tier),
        usedToday: Number(used.get(u.id) ?? 0),
      };
    });
    return {
      users,
      overview: {
        totalUsers: users.length,
        proUsers: users.filter((u: any) => u.isPro).length,
        bannedUsers: users.filter((u: any) => u.banned).length,
        messagesToday: users.reduce((s: number, u: any) => s + u.usedToday, 0),
        activeToday: users.filter((u: any) => u.usedToday > 0).length,
      },
      audit: (audit ?? []).map((a: any): AdminAuditRow => ({ id: a.id, action: a.action as string, details: a.details, createdAt: a.created_at as string, target: a.target_user_id ? emails.get(a.target_user_id) ?? a.target_user_id : null, admin: emails.get(a.admin_id) ?? a.admin_id })),
    };
  });

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reset_all") }),
  z.object({ type: z.literal("reset_usage"), userId: z.string().uuid() }),
  z.object({ type: z.literal("set_limit"), userId: z.string().uuid(), dailyLimit: z.number().int().min(0).max(100000).nullable() }),
  z.object({ type: z.literal("grant_pro"), userId: z.string().uuid(), until: z.string().datetime().nullable(), tier: z.enum(["pro", "ultra"]).default("pro") }),
  z.object({ type: z.literal("revoke_pro"), userId: z.string().uuid() }),
  z.object({ type: z.literal("ban"), userId: z.string().uuid() }),
  z.object({ type: z.literal("unban"), userId: z.string().uuid() }),
]);
export type AdminAction = z.infer<typeof actionSchema>;

export const runAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminAction) => actionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context as Ctx);
    const upsert = async (userId: string, patch: Record<string, unknown>) => {
      const { error } = await admin.from("account_controls").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error("保存失败");
    };
    const target = "userId" in data ? data.userId : null;
    if (target === context.userId && data.type === "ban") throw new Error("不能停用自己的账号");
    switch (data.type) {
      case "reset_all": { const { error } = await admin.from("usage_daily").delete().eq("day", today()); if (error) throw new Error("重置失败"); break; }
      case "reset_usage": { const { error } = await admin.from("usage_daily").delete().eq("day", today()).eq("user_id", data.userId); if (error) throw new Error("重置失败"); break; }
      case "set_limit": await upsert(data.userId, { daily_limit: data.dailyLimit }); break;
      case "grant_pro": await upsert(data.userId, { pro_granted: true, pro_until: data.until, granted_tier: data.tier }); break;
      case "revoke_pro": await upsert(data.userId, { pro_granted: false, pro_until: null, granted_tier: "pro" }); break;
      case "ban": await upsert(data.userId, { banned: true }); await admin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" }); break;
      case "unban": await upsert(data.userId, { banned: false }); await admin.auth.admin.updateUserById(data.userId, { ban_duration: "none" }); break;
    }
    const { type, ...details } = data as any;
    delete details.userId;
    await admin.from("admin_audit_log").insert({ admin_id: context.userId, target_user_id: target, action: type, details });
    return { ok: true };
  });
