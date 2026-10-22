import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { briefingInput } from "./briefing";

export const getBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("briefing_settings").select("*").eq("user_id", context.userId).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tg } = await supabaseAdmin.from("app_user_connections").select("account_key,account_label,enabled").eq("user_id", context.userId).eq("connector_id", "telegram");
    return { settings: data, telegramAccounts: (tg ?? []).filter((t) => t.enabled).map((t) => ({ key: t.account_key, label: t.account_label || t.account_key })) };
  });

export const saveBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => briefingInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.enabled && !data.telegramChatId) throw new Error("请先选择接收早报的 Telegram 聊天");
    const { error } = await context.supabase.from("briefing_settings").upsert({
      user_id: context.userId, enabled: data.enabled, hour: data.hour, timezone: data.timezone, sources: data.sources,
      telegram_account: data.telegramAccount, telegram_chat_id: data.telegramChatId, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("保存失败");
    return { ok: true };
  });

export const telegramChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d && typeof d === "object" && typeof (d as { account?: unknown }).account === "string" ? { account: (d as { account: string }).account.slice(0, 200) } : { account: "" }))
  .handler(async ({ data, context }) => {
    const { executeOperation } = await import("./connections/execute.server");
    const r = await executeOperation(context.userId, "telegram", { operation: "updates", ...(data.account ? { account: data.account } : {}) });
    return { chats: (r.items ?? []).map((i) => ({ id: i.id ?? "", title: i.title })), note: r.text ?? (r.status === "completed" ? "" : r.summary) };
  });

export const sendBriefingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("briefing_settings").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data?.telegram_chat_id) throw new Error("请先保存 Telegram 接收聊天");
    const { runBriefing } = await import("./briefing.server");
    try {
      const r = await runBriefing(data);
      await context.supabase.from("briefing_settings").update({ last_status: "sent", last_error: "", last_run_at: new Date().toISOString() }).eq("user_id", context.userId);
      return { ok: true, preview: r.text.slice(0, 400) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "发送失败";
      await context.supabase.from("briefing_settings").update({ last_status: "error", last_error: msg, last_run_at: new Date().toISOString() }).eq("user_id", context.userId);
      throw new Error(msg);
    }
  });
