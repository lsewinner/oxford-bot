import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";
import { buildInstructions, type ChatMode } from "./modes";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function json(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function handleChat(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI 服务未配置");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "请先登录");
  const supabase = userClient(token);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return json(401, "登录已失效，请重新登录");
  const userId = userData.user.id;

  let body: { messages?: UIMessage[]; threadId?: string; mode?: ChatMode; webSearch?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(400, "请求格式错误");
  }
  const messages = body.messages;
  const threadId = body.threadId;
  const mode: ChatMode = body.mode === "fun" ? "fun" : "normal";
  const webSearch = body.webSearch === true;
  if (!Array.isArray(messages) || messages.length === 0 || !threadId) return json(400, "缺少消息或会话");

  const { data: thread, error: threadErr } = await supabase
    .from("threads")
    .select("id, title")
    .eq("id", threadId)
    .maybeSingle();
  if (threadErr) return json(500, "读取会话失败");
  if (!thread) return json(404, "会话不存在");

  const last = messages[messages.length - 1];
  if (last && last.role === "user") {
    const { error } = await supabase
      .from("messages")
      .upsert(
        { thread_id: threadId, user_id: userId, ui_id: last.id, role: "user", parts: last.parts as never },
        { onConflict: "thread_id,ui_id" },
      );
    if (error) {
      console.error("save user message failed", error);
      return json(500, "保存消息失败");
    }
    const keepIds = messages.map((m) => m.id);
    const { error: pruneErr } = await supabase
      .from("messages")
      .delete()
      .eq("thread_id", threadId)
      .not("ui_id", "in", `(${keepIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`);
    if (pruneErr) console.error("prune messages failed", pruneErr);
    const firstText = last.parts.find((p) => p.type === "text");
    const updates: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (thread.title === "新对话" && firstText && "text" in firstText) {
      updates.title = firstText.text.trim().slice(0, 40) || "新对话";
    }
    await supabase.from("threads").update(updates).eq("id", threadId);
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: buildInstructions(mode, webSearch),
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    ...(webSearch
      ? { tools: { web_search: provider.tools.webSearch() }, toolChoice: "auto" as const }
      : {}),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    sendSources: true,
    onError: (error) => {
      console.error("chat stream error", error);
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 429) return "请求太频繁，请稍后再试";
      if (status === 402) return "AI 额度已用完，请在设置中充值";
      return "AI 回复出错，请重试";
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (!responseMessage?.parts?.length) return;
      const { error } = await supabase.from("messages").upsert(
        {
          thread_id: threadId,
          user_id: userId,
          ui_id: responseMessage.id,
          role: "assistant",
          parts: responseMessage.parts as never,
        },
        { onConflict: "thread_id,ui_id" },
      );
      if (error) console.error("save assistant message failed", error, { isAborted });
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
