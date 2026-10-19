import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { BotPresenceLabel, BotPresenceProvider, BotSettings, NewBot, useBotPresence } from "@/components/chat/bot-presence";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { UIMessage } from "ai";

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
  return <ModeProvider><WebSearchProvider><BotPresenceProvider><GuestSurface /></BotPresenceProvider></WebSearchProvider></ModeProvider>;
}

function GuestBots({ onSelect }: { onSelect?: () => void }) {
  const { activities, entries, register } = useBotPresence();
  const activity = activities["guest"];
  return <div className="h-full bg-sidebar px-3 py-5 text-sidebar-foreground">
    <div className="mb-6 flex items-center gap-2 px-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-semibold">Oxford Bot</span></div>
    <div className="flex items-center justify-between px-2 pb-2"><span className="text-[11px] text-muted-foreground">我的 Bots</span><NewBot onCreate={(bot) => { const messageId = `manual-${crypto.randomUUID()}`; register([{ id: `guest:${messageId}`, threadId: "guest", messageId, bot }]); onSelect?.(); }} /></div>
    {entries.length ? entries.map((entry, index) => <div key={entry.id} className="mb-1 flex items-center rounded-lg bg-sidebar-accent">
      <Button variant="ghost" aria-label={`打开 ${entry.bot.name}`} onClick={() => { onSelect?.(); document.getElementById(`message-${entry.messageId}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }} className="h-auto min-w-0 flex-1 justify-start gap-2.5 px-2 py-3 text-left"><BotPresenceLabel bot={entry.bot} status={index === entries.length - 1 ? activity?.status ?? "ready" : "ready"} /></Button>
      <BotSettings entry={entry} />
    </div>) : <p className="px-2 text-xs text-muted-foreground">暂无 Bot</p>}
  </div>;
}

function GuestSurface() {
  const [open, setOpen] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("oxford:guest-messages:v1") ?? "[]"); setInitialMessages(Array.isArray(saved) ? saved.filter((message) => typeof message?.id === "string" && ["user", "assistant"].includes(message.role) && Array.isArray(message.parts)) : []); }
    catch { setInitialMessages([]); }
  }, []);
  return <div className="flex h-dvh overflow-hidden bg-background">
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block"><GuestBots /></aside>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">我的 Bots</SheetTitle><GuestBots onSelect={() => setOpen(false)} /></SheetContent></Sheet>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="打开我的 Bots" onClick={() => setOpen(true)}><MenuIcon /></Button><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></div>
        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">游客 · 本机保存</span><Button asChild size="sm" variant="outline"><Link to="/auth">登录</Link></Button></div>
      </header>
      <div className="min-h-0 flex-1">{initialMessages && <ChatWindow threadId="guest" initialMessages={initialMessages} />}</div>
    </main>
  </div>;
}