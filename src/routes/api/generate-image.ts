import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

export const Route = createFileRoute("/api/generate-image")({
  server: { handlers: { POST: async ({ request }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return Response.json({ error: "AI 服务未配置" }, { status: 500 });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) return Response.json({ error: "登录服务未配置" }, { status: 500 });
      const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return Response.json({ error: "登录已失效，请重新登录" }, { status: 401 });
    }
    let body: { prompt?: unknown; stream?: boolean };
    try { body = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 8000) return Response.json({ error: "请输入有效的图片描述（最多 8000 字）" }, { status: 400 });
    const upstream = await generateImage({ ...imageSettings, apiKey }, body.prompt, body.stream !== false);
    const headers = new Headers({ "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache" });
    upstream.headers.forEach((value, key) => { if (key.toLowerCase().startsWith("x-lovable-aig-")) headers.set(key, value); });
    return new Response(upstream.body, { status: upstream.status, headers });
  } } },
});