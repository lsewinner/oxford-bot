import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal/legal-page";
import { DesktopInstallButton } from "@/components/desktop-install";

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background bg-glow px-6 pb-8 pt-24 text-center">
      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold"><img src={logo} alt="" width={28} height={28} />Oxford Bot</Link>
        <nav aria-label="主导航"><DesktopInstallButton /></nav>
      </header>
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
      <section aria-labelledby="about-heading" className="mt-16 w-full max-w-2xl border-t border-border pt-10 text-left text-sm leading-7 text-muted-foreground">
        <h2 id="about-heading" className="text-base font-semibold text-foreground">About Oxford Bot · 关于 Oxford Bot</h2>
        <p className="mt-3">Oxford Bot is an AI work assistant by OXFORD INTELLIGENCE LIMITED. It answers questions, searches the web, analyses files and images, and — only when you choose to connect them — works with your own tools such as Gmail, Google Calendar, Google Drive, Outlook, Notion and GitHub.</p>
        <p className="mt-3">Oxford Bot 是 Oxford Intelligence 推出的 AI 工作助手：回答问题、联网搜索、分析文件与图片；在你主动授权后，帮你查阅邮件、日程和文档。任何发送邮件、创建日程或修改文档的操作，都必须由你在确认卡片中点击确认后才会执行。</p>
        <ul className="mt-4 list-disc space-y-1 pl-5">
          <li>Google Calendar: view your events and create events you confirm.</li>
          <li>Gmail: search and read messages, draft or send replies you confirm.</li>
          <li>Google Drive: find and read files you ask about, create files you confirm.</li>
        </ul>
        <p className="mt-3">You can use guest chat without an account. Learn how we handle your data in our <Link to="/privacy" className="text-foreground underline">Privacy Policy</Link>.</p>
      </section>
      <div className="mt-6"><LegalLinks /></div>
    </div>
  );
}
