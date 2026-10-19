import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/guest")({
  head: () => ({ meta: [
    { title: "游客对话 · Oxford Bot" },
    { name: "description", content: "无需登录即可与 Oxford Bot 对话；游客对话不保存到云端。" },
    { property: "og:title", content: "游客对话 · Oxford Bot" },
    { property: "og:description", content: "无需登录即可与 Oxford Bot 对话；游客对话不保存到云端。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GuestChat,
});
function GuestChat() {
  return <ModeProvider><WebSearchProvider>
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></div>
        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">游客 · 不保存</span><Button asChild size="sm" variant="outline"><Link to="/auth">登录</Link></Button></div>
      </header>
      <div className="min-h-0 flex-1"><ChatWindow threadId="guest" initialMessages={[]} /></div>
    </main>
  </WebSearchProvider></ModeProvider>;
}