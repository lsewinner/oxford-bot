import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  zh: { nav: "主导航", tagline: <>直接、机智、偶尔叛逆的 AI。正经问题用 Normal，想找乐子切<span className="whitespace-nowrap"> Fun。</span></>, login: "登录并开始对话", guest: "游客对话", pwa: "{t.pwa}", pricing: "查看价格与权益", about: "关于 Oxford Bot", body: <>Oxford Bot 是 Oxford Intelligence 推出的 AI 工作助手：回答问题、联网搜索、分析文件，并在你授权后连接常用工具。任何写入操作都需你确认后才会执行。详见<Link to="/privacy" className="text-foreground underline">隐私政策</Link>。</>, toggle: "EN" },
  en: { nav: "Main navigation", tagline: <>A direct, witty, occasionally rebellious AI. Use Normal for serious questions, switch to<span className="whitespace-nowrap"> Fun for laughs.</span></>, login: "Sign in and start chatting", guest: "Chat as guest", pwa: "Tap “Add to Home Screen” in your mobile browser to use it like an app", pricing: "See pricing and plans", about: "About Oxford Bot", body: <>Oxford Bot is an AI work assistant by Oxford Intelligence: it answers questions, searches the web, analyses files and, once you authorise it, connects to the tools you use. Nothing is ever written without your confirmation. See our <Link to="/privacy" className="text-foreground underline">privacy policy</Link>.</>, toggle: "中文" },
} as const;
type Lang = keyof typeof COPY;

function Index() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("zh");
  useEffect(() => {
    const saved = localStorage.getItem("oxford-lang");
    if (saved === "zh" || saved === "en") setLang(saved);
    else if (!navigator.language.toLowerCase().startsWith("zh")) setLang("en");
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; }, [lang]);
  const t = COPY[lang];
  const switchLang = () => { const next: Lang = lang === "zh" ? "en" : "zh"; setLang(next); localStorage.setItem("oxford-lang", next); };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background bg-glow px-6 pb-8 pt-24 text-center">
      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold"><img src={logo} alt="" width={28} height={28} />Oxford Bot</Link>
        <nav aria-label={t.nav} className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={switchLang} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>{t.toggle}</Button><DesktopInstallButton /></nav>
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
      <div className="mt-6"><LegalLinks /></div>
    </div>
  );
}
