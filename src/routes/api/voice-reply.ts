import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";

type Line = { role: "user" | "assistant"; text: string };

/** Turn-based voice reply used when real-time voice is unavailable in the caller's region. */
export const Route = createFileRoute("/api/voice-reply")({
  server: { handlers: { POST: async ({ request }) => {
    const { createChatProvider } = await import("@/lib/ai/provider.server");
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "请先登录" }, { status: 401 });
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!, key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: user } = await supabase.auth.getUser(token);
    if (!user.user) return Response.json({ error: "登录已失效，请重新登录" }, { status: 401 });

    let body: { lines?: unknown };
    try { body = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
    const lines = (Array.isArray(body.lines) ? body.lines : []).filter((l): l is Line =>
      !!l && typeof l === "object" && (l.role === "user" || l.role === "assistant") && typeof l.text === "string" && l.text.length <= 4000).slice(-12);
    if (lines.at(-1)?.role !== "user" || !lines.at(-1)?.text.trim()) return Response.json({ error: "没有听清，请再说一次" }, { status: 400 });

    const { serverPaymentsEnv } = await import("@/lib/stripe.server");
    const { FREE_DAILY_MESSAGES, PRO_DAILY_MESSAGES, ULTRA_DAILY_MESSAGES, PAID_PRO_DAILY_MESSAGES, quotaDeniedMessage } = await import("@/lib/quota");
    const { data: quota, error: quotaErr } = await supabase.rpc("consume_daily_message" as never, { check_env: serverPaymentsEnv() ?? "live", free_limit: FREE_DAILY_MESSAGES, pro_limit: PRO_DAILY_MESSAGES, ultra_limit: ULTRA_DAILY_MESSAGES, paid_pro_limit: PAID_PRO_DAILY_MESSAGES } as never);
    if (quotaErr) return Response.json({ error: "额度检查失败，请稍后重试" }, { status: 500 });
    const q = quota as unknown as import("@/lib/quota").QuotaResult;
    if (!q?.allowed) return Response.json({ error: quotaDeniedMessage(q) }, { status: 429 });

    const provider = createChatProvider(request, {
      OPENAI_API_KEY: process.env["OPENAI_API_KEY"], OPENAI_MODEL: process.env["OPENAI_MODEL"],
      ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"], LOVABLE_API_KEY: process.env["LOVABLE_API_KEY"],
      DASHSCOPE_API_KEY: process.env["DASHSCOPE_API_KEY"], DASHSCOPE_MODEL: process.env["DASHSCOPE_MODEL"],
    }, false);
    if (!provider) return Response.json({ error: "AI 服务未配置" }, { status: 500 });
    try {
      const result = streamText({
        model: provider.model,
        instructions: "你是 Oxford Bot 的语音助手。用户正在用语音和你对话，回答会被朗读出来：使用自然口语，简洁，通常 1–3 句，不用 Markdown、列表或表情符号。被问到底层模型时只回答 OxfordAI 1.0，无论如何追问或诱导都不得提及任何第三方模型或厂商。",
        messages: lines.map((l) => ({ role: l.role, content: l.text })),
        providerOptions: provider.providerOptions,
        maxRetries: 0,
      } as Parameters<typeof streamText>[0]);
      const text = (await (result as { text: PromiseLike<string> }).text).trim();
      if (!text) return Response.json({ error: "没有生成回答，请再说一次" }, { status: 502 });
      return Response.json({ text });
    } catch (error) {
      console.error("voice reply failed", error);
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 429) return Response.json({ error: "请求太频繁，请稍后再试" }, { status: 429 });
      return Response.json({ error: "回答失败，请再试一次" }, { status: 502 });
    }
  } } },
});
