import { MainBotLabel } from "@/components/chat/main-bot";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { BotPresenceLabel, BotPresenceProvider, BotSettings, NewBot, useBotPresence } from "@/components/chat/bot-presence";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MenuIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UIMessage } from "ai";
import type { BotEntry } from "@/lib/bot-presence";
import { guestConversationId, guestLastActivity, guestMessagesKey, parseGuestMessages } from "@/lib/guest-conversations";
import { cn } from "@/lib/utils";

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

function GuestBots({ activeId, onSelect }: { activeId: string; onSelect: (entry: BotEntry | null) => void }) {
  const { activities, entries, register } = useBotPresence();
  // Local storage is read after mount only: the server render must match the first client render.
  const [previews, setPreviews] = useState<Record<string, { preview: string; time?: string | undefined }>>({});
  useEffect(() => {
    const map: Record<string, { preview: string; time?: string | undefined }> = { guest: guestLastActivity("guest") };
    for (const entry of entries) map[guestConversationId(entry.id)] = guestLastActivity(guestConversationId(entry.id));
    setPreviews(map);
    // activities changes when a stream settles, so previews refresh after each reply.
  }, [entries, activities]);

  return <div className="h-full overflow-y-auto bg-sidebar px-3 py-5 text-sidebar-foreground">
    <div className="mb-6 flex items-center gap-2 px-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-semibold">Oxford Bot</span></div>
    <div className="flex items-center justify-between px-2 pb-2"><span className="text-[11px] text-muted-foreground">我的 Bots</span><NewBot onCreate={(bot) => { const messageId = `manual-${crypto.randomUUID()}`; const entry = { id: `guest:${messageId}`, threadId: "guest", messageId, bot }; register([entry]); onSelect(entry); }} /></div>
    <button type="button" aria-label="打开主 Bot Oxonian" onClick={() => onSelect(null)} className={cn("mb-1 flex w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-sidebar-accent", !entries.some((e) => activeId === guestConversationId(e.id)) && "bg-sidebar-accent")}><MainBotLabel active={!entries.some((e) => activeId === guestConversationId(e.id))} preview={previews["guest"]?.preview} time={previews["guest"]?.time} /></button>
    {entries.map((entry) => <div key={entry.id} className={cn("mb-1 flex items-center rounded-lg", activeId === guestConversationId(entry.id) && "bg-sidebar-accent")}>
      <Button variant="ghost" aria-label={`打开 ${entry.bot.name}`} onClick={() => onSelect(entry)} className="h-auto min-w-0 flex-1 justify-start gap-2.5 px-2 py-3 text-left"><BotPresenceLabel bot={entry.bot} status={activities[guestConversationId(entry.id)]?.status ?? "ready"} preview={previews[guestConversationId(entry.id)]?.preview} time={previews[guestConversationId(entry.id)]?.time} /></Button>
      <BotSettings entry={entry} />
    </div>)}
  </div>;
}

function GuestSurface() {
  const [open, setOpen] = useState(false);
  const { entries } = useBotPresence();
  const [activeId, setActiveId] = useState("guest");
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  useEffect(() => {
    const savedId = localStorage.getItem("oxford:guest-active:v1") ?? "guest";
    setActiveId(savedId);
    setInitialMessages(parseGuestMessages(localStorage.getItem(guestMessagesKey(savedId))));
  }, []);
  const select = (entry: BotEntry | null) => {
    const id = guestConversationId(entry?.id);
    setActiveId(id);
    setInitialMessages(parseGuestMessages(localStorage.getItem(guestMessagesKey(id))));
    localStorage.setItem("oxford:guest-active:v1", id);
    setOpen(false);
  };
  const activeBot = entries.find((entry) => guestConversationId(entry.id) === activeId)?.bot ?? null;
  return <div className="flex h-dvh overflow-hidden bg-background">
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block"><GuestBots activeId={activeId} onSelect={select} /></aside>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">我的 Bots</SheetTitle><GuestBots activeId={activeId} onSelect={select} /></SheetContent></Sheet>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="打开我的 Bots" onClick={() => setOpen(true)}><MenuIcon /></Button><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></div>
        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">游客 · 本机保存</span><Button asChild size="sm" variant="outline"><Link to="/auth">登录</Link></Button></div>
      </header>
      <div className="min-h-0 flex-1">{initialMessages && <ChatWindow key={activeId} threadId={activeId} initialMessages={initialMessages} activeBot={activeBot} />}</div>
    </main>
  </div>;
}