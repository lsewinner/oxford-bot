import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oxford Bot — 极简暗黑 AI 聊天助手" },
      { name: "description", content: "Oxford Bot：极简暗黑科技风 AI 聊天，支持 Fun / Normal 模式、流式回复、代码高亮，可安装到手机桌面。" },
      { property: "og:title", content: "Oxford Bot — 极简暗黑 AI 聊天助手" },
      { property: "og:description", content: "极简暗黑科技风 AI 聊天，支持 Fun / Normal 模式与代码高亮。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background bg-glow px-6 text-center">
      <img src={logo} alt="Oxford Bot" width={88} height={88} className="size-22 rounded-3xl" />
      <h1 className="mt-8 text-4xl font-semibold tracking-tight md:text-6xl">Oxford Bot</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        直接、机智、偶尔叛逆的 AI。正经问题用 Normal，想找乐子切 Fun。
      </p>
      <Link
        to="/auth"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        开始对话
      </Link>
      <p className="mt-6 font-mono text-xs text-muted-foreground">在手机浏览器中「添加到主屏幕」即可像 App 一样使用</p>
    </div>
  );
}
