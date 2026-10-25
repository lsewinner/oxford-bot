import { useLang } from "@/lib/i18n";
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

const COPY = {
  zh: { nav: "主导航", tagline: <>直接、机智、偶尔叛逆的 AI。正经问题用 Normal，想找乐子切<span className="whitespace-nowrap"> Fun。</span></>, login: "登录并开始对话", guest: "游客对话", pwa: "在手机浏览器中「添加到主屏幕」即可像 App 一样使用", pricing: "查看价格与权益", about: "关于 Oxford Bot", body: <>Oxford Bot 是 Oxford Intelligence 推出的 AI 工作助手：回答问题、联网搜索、分析文件，并在你授权后连接常用工具。任何写入操作都需你确认后才会执行。详见<Link to="/privacy" className="text-foreground underline">隐私政策</Link>。</>, toggle: "EN" },
  en: { nav: "Main navigation", tagline: <>A direct, witty, occasionally rebellious AI. Use Normal for serious questions, switch to<span className="whitespace-nowrap"> Fun for laughs.</span></>, login: "Sign in and start chatting", guest: "Chat as guest", pwa: "Tap “Add to Home Screen” in your mobile browser to use it like an app", pricing: "See pricing and plans", about: "About Oxford Bot", body: <>Oxford Bot is an AI work assistant by Oxford Intelligence: it answers questions, searches the web, analyses files and, once you authorise it, connects to the tools you use. Nothing is ever written without your confirmation. See our <Link to="/privacy" className="text-foreground underline">privacy policy</Link>.</>, toggle: "中文" },
} as const;
type Lang = keyof typeof COPY;

function Index() {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const t = COPY[lang];
  const switchLang = () => setLang(lang === "zh" ? "en" : "zh");
  useEffect(() => {
    const check = () => supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
    void check();
    const onShow = () => { void check(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [navigate]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background bg-glow px-6 pb-8 pt-24 text-center">
      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold"><img src={logo} alt="" width={28} height={28} />Oxford Bot</Link>
        <nav aria-label={t.nav} className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={switchLang} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>{t.toggle}</Button><DesktopInstallButton lang={lang} /></nav>
      </header>
      <img src={logo} alt="Oxford Bot" width={88} height={88} className="size-22 rounded-3xl" />
      <h1 className="mt-8 text-4xl font-semibold tracking-tight md:text-6xl">Oxford Bot</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t.tagline}</p>
      <Link
        to="/auth"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t.login}
      </Link>
      <Button asChild variant="ghost" className="mt-3"><Link to="/guest">{t.guest}</Link></Button>
      <p className="mt-6 font-mono text-xs text-muted-foreground">{t.pwa}</p>
      <Link to="/pricing" className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline">{t.pricing}</Link>
      <section aria-labelledby="about-heading" className="mt-16 w-full max-w-2xl border-t border-border pt-10 text-left text-sm leading-7 text-muted-foreground">
        <h2 id="about-heading" className="text-base font-semibold text-foreground">{t.about}</h2>
        <p className="mt-3">{t.body}</p>
      </section>
      {lang === "zh" ? (
        <section lang="zh-CN" aria-labelledby="what-heading" className="mt-10 w-full max-w-2xl border-t border-border pt-10 text-left text-sm leading-7 text-muted-foreground">
          <h2 id="what-heading" className="text-base font-semibold text-foreground">Oxford Bot 能做什么</h2>
          <p className="mt-3">Oxford Bot 是英国 Oxford Intelligence Limited 推出的 AI 助手网页应用。无需注册即可游客试用；注册免费账户后你可以：</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>与 AI 助手对话：回答问题、联网搜索、分析图片和 PDF。</li>
            <li>创建有名字的助手「Bot」，录制会议并获得转写与纪要，建立私人知识库。</li>
            <li>按需连接你自己的工具（如 Google 日历、Gmail、Google 云端硬盘、Notion、GitHub、Slack），让助手读取你询问的内容。</li>
          </ul>
          <h3 className="mt-6 font-semibold text-foreground">Oxford Bot 如何使用 Google 数据</h3>
          <p className="mt-2">Google 授权完全可选，只有在「工具与连接」中点击某项 Google 服务的「连接」后才会开始。Oxford Bot 仅在你于对话中询问时读取 Gmail 邮件、云端硬盘文件或日历事件；起草或发送邮件、创建文件、添加日历事件都必须在你点击确认按钮后才会执行。Google 数据绝不出售、绝不用于广告、绝不用于训练 AI 模型，你可随时断开连接。详见<Link to="/privacy" className="text-foreground underline">隐私政策</Link>。</p>
        </section>
      ) : (
      <section lang="en" aria-labelledby="what-heading" className="mt-10 w-full max-w-2xl border-t border-border pt-10 text-left text-sm leading-7 text-muted-foreground">
        <h2 id="what-heading" className="text-base font-semibold text-foreground">What Oxford Bot does</h2>
        <p className="mt-3">Oxford Bot is an AI assistant web app made by Oxford Intelligence Limited (UK). Anyone can try it as a guest without an account. With a free account you can:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Chat with an AI assistant that answers questions, searches the web and analyses images and PDFs.</li>
          <li>Create named assistant “Bots”, record meetings and get transcripts and summaries, and keep a private knowledge base.</li>
          <li>Optionally connect your own tools (for example Google Calendar, Gmail, Google Drive, Notion, GitHub, Slack) so the assistant can read what you ask about.</li>
        </ul>
        <h3 className="mt-6 font-semibold text-foreground">How Oxford Bot uses Google data</h3>
        <p className="mt-2">Google access is optional and only starts when you click “Connect” for a Google service in Tools &amp; Connections. Oxford Bot reads Gmail messages, Drive files or Calendar events only when you ask about them in chat, and it drafts or sends an email, creates a file or adds a calendar event only after you click a confirmation button. Google data is never sold, never used for advertising and never used to train AI models. You can disconnect at any time. Details are in our <Link to="/privacy" className="text-foreground underline">Privacy Policy</Link>.</p>
      </section>
      )}
      <div className="mt-6"><LegalLinks lang={lang} /></div>
    </div>
  );
}
