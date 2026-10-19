import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal/legal-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oxford Bot" },
      { name: "description", content: "Oxford Bot：支持联网搜索、生图与文件分析、语音对话的 AI 助手，Fun / Normal 两种模式，可安装到手机桌面。" },
      { property: "og:title", content: "Oxford Bot" },
      { property: "og:description", content: "支持联网搜索、生图与文件分析的 AI 助手，Fun / Normal 两种模式。" },
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
        直接、机智、偶尔叛逆的 AI。正经问题用 Normal，想找乐子切<span className="whitespace-nowrap"> Fun。</span>
      </p>
      <Link
        to="/auth"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        登录并开始对话
      </Link>
      <Button asChild variant="ghost" className="mt-3"><Link to="/guest">游客对话</Link></Button>
      <p className="mt-6 font-mono text-xs text-muted-foreground">在手机浏览器中「添加到主屏幕」即可像 App 一样使用</p>
      <Link to="/pricing" className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline">查看价格与权益</Link>
      <div className="mt-6"><LegalLinks /></div>
    </div>
  );
}
