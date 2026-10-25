import { tz } from "@/lib/i18n";
import { botListRowClass } from "@/components/chat/bot-list-label";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/admin.functions";
import { MainBotLabel } from "@/components/chat/main-bot";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { MenuIcon, PenSquareIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { threadsQuery, botHistoryQuery, threadPreviewsQuery, createThread, renameBotThread, type Thread } from "@/lib/chat-data";
import { cn } from "@/lib/utils";
import { BotPresenceLabel, BotPresenceProvider, BotSettings, NewBot, useBotPresence } from "@/components/chat/bot-presence";
import { Button } from "@/components/ui/button";
import { AccountProfile } from '@/components/chat/account-profile';
import { ProBadge } from '@/components/pro/upgrade-dialog';
import { usePro } from '@/components/pro/pro-context';
import { LockIcon, BrainCircuitIcon } from 'lucide-react';
import { takeBotCopy, type TrialMessage } from "@/lib/bot-copy";
import { canAddBot } from "@/lib/pro";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: tz("Oxford Bot · 对话") },
      { name: "description", content: tz("与 Oxford Bot 对话，支持 Fun / Normal 模式与代码高亮。") },
      { property: "og:title", content: tz("Oxford Bot · 对话") },
      { property: "og:description", content: tz("与 Oxford Bot 对话，支持 Fun / Normal 模式与代码高亮。") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatLayout,
});

function groupLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000;
  if (diff <= 0) return tz("今天");
  if (diff <= 1) return tz("昨天");
  if (diff <= 7) return tz("过去 7 天");
  return tz("更早");
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: threads = [] } = useQuery(threadsQuery());
  const params = useParams({ strict: false }) as { threadId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const { activities, entries, register, removeThread, linkConversation } = useBotPresence();
  const { data: history } = useQuery(botHistoryQuery(user.id));
  useEffect(() => { if (history) register(history); }, [history, register]);
  const bots = entries;
  const createBot = async (bot: (typeof entries)[number]["bot"], trial: TrialMessage[] = []) => {
    const threadId = await createThread();
    const { error } = await supabase.from("threads").update({ title: bot.name }).eq("id", threadId);
    if (error) throw error;
    if (trial.length) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const rows = trial.map((m) => ({ thread_id: threadId, user_id: u.user!.id, ui_id: `trial-${crypto.randomUUID()}`, role: m.role, parts: [{ type: "text", text: m.text }] }));
        // Inserted one by one so created_at preserves the trial order.
        for (const row of rows) { const { error: e } = await supabase.from("messages").insert(row); if (e) break; }
      }
    }
    const messageId = `manual-${crypto.randomUUID()}`;
    register([{ id: `${threadId}:${messageId}`, threadId, conversationId: threadId, messageId, bot }]);
    await queryClient.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId } });
    onNavigate?.();
  };

  const { isPro, openUpgrade } = usePro();
  // Bots copied from a share link arrive through a one-shot handoff after mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      const copied = takeBotCopy();
      if (!copied) return;
      const { trial, ...bot } = copied;
      if (!canAddBot(isPro, entries.length)) { openUpgrade("bot"); toast.error(tz("免费账户只能养 1 只自建 Bot，升级 Pro 后可复制更多")); return; }
      void createBot(bot, trial).then(() => toast.success(trial.length ? tz("已复制「{0}」和试聊记录到我的 Bots", bot.name) : tz("已复制「{0}」到我的 Bots", bot.name)), () => toast.error(tz("复制 Bot 失败，请重试")));
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isAdmin = useAdminFlag();
  const [opening, setOpening] = useState<string | null>(null);
  const openBot = async (entry: (typeof entries)[number]) => {
    if (opening) return;
    if (!isPro) { openUpgrade("bot"); return; }
    setOpening(entry.id);
    try {
      let target = entry.conversationId;
      if (!target) {
        target = entry.messageId.startsWith("manual-") ? entry.threadId : await createThread();
        const { error } = await supabase.from("threads").update({ title: entry.bot.name }).eq("id", target);
        if (error) throw error;
        linkConversation(entry.id, target);
        await queryClient.invalidateQueries({ queryKey: ["threads"] });
      }
      await navigate({ to: "/chat/$threadId", params: { threadId: target } });
      onNavigate?.();
    } catch { toast.error(tz("打开 Bot 对话失败，请重试")); }
    finally { setOpening(null); }
  };

  const botThreadIds = Array.from(new Set(bots.map((entry) => entry.conversationId ?? entry.threadId).filter(Boolean)));
  const { data: previews = {} } = useQuery({ ...threadPreviewsQuery(botThreadIds), enabled: botThreadIds.length > 0 });
  const firstThread = threads[0];
  const oxonianPreview = firstThread ? previews[firstThread.id]?.preview : undefined;
  const oxonianTime = firstThread ? previews[firstThread.id]?.updatedAt : undefined;

  const groups = threads.filter((t) => !bots.some((b) => b.conversationId === t.id || (b.messageId.startsWith("manual-") && b.threadId === t.id))).reduce<Record<string, Thread[]>>((acc, t) => {
    (acc[groupLabel(t.updated_at)] ??= []).push(t);
    return acc;
  }, {});

  const remove = async (id: string) => {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error(tz("删除失败"));
      throw error;
    }
    removeThread(id);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    if (params.threadId === id) navigate({ to: "/chat" });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <img src={logo} alt="Oxford Bot" width={28} height={28} className="size-7 rounded-md" />
        <span className="text-[15px] font-semibold tracking-tight">Oxford Bot</span><ProBadge />
      </div>
      <div className="px-3">
        <Link
          to="/chat"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
        >
          <PenSquareIcon className="size-4" /> {tz("新建对话")}
        </Link>
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
        <section aria-label={tz("我的 Bots")} className="mb-5">
          <div className="flex items-center justify-between px-3 pb-2"><span className="text-[11px] font-medium text-muted-foreground">{tz("我的 Bots")}</span><NewBot onCreate={createBot} /></div>
          <Link to="/chat" onClick={onNavigate} aria-label={tz("打开主 Bot Oxonian")} className={cn(botListRowClass, !params.threadId && "bg-sidebar-accent")}>
            <MainBotLabel active={!params.threadId} preview={oxonianPreview} time={oxonianTime} />
          </Link>
          {bots.map((entry) => <div key={entry.id} className="group relative">
            <Button variant="ghost" disabled={opening !== null} onClick={() => openBot(entry)} className={cn(botListRowClass, "justify-start hover:bg-sidebar-accent", params.threadId === entry.conversationId && "bg-sidebar-accent")} aria-label={tz("打开 {0}", entry.bot.name)}>
              {!isPro && <LockIcon aria-label={tz("Pro 专属")} className="absolute left-1 top-1 z-10 size-3 text-muted-foreground" />}<BotPresenceLabel bot={entry.bot} status={activities[entry.conversationId ?? entry.threadId]?.status ?? "ready"} preview={previews[entry.conversationId ?? entry.threadId]?.preview} time={previews[entry.conversationId ?? entry.threadId]?.updatedAt} />
            </Button>
            <div className="absolute bottom-2 right-2 flex h-6 items-center gap-1">
            <BotSettings entry={entry} onRename={async (name) => { await renameBotThread(entry, name); await queryClient.invalidateQueries({ queryKey: ["threads"] }); }} onDelete={async () => { const target = entry.conversationId ?? (entry.messageId.startsWith("manual-") ? entry.threadId : null); if (target) await remove(target); }} />
            {entry.conversationId && <Button variant="ghost" size="icon-sm" aria-label={tz("删除 {0} 会话", entry.bot.name)} onClick={() => void remove(entry.conversationId ?? entry.threadId).catch(() => {})} className="size-6 shrink-0 text-muted-foreground hover:text-destructive [&_svg]:size-3.5 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"><Trash2Icon /></Button>}
            </div>
          </div>)}
        </section>
        {threads.length === 0 && <p className="px-3 text-xs text-muted-foreground">{tz("还没有对话")}</p>}
        {[tz("今天"), tz("昨天"), tz("过去 7 天"), tz("更早")].map(
          (g) =>
            groups[g] && (
              <div key={g} className="mb-4">
                <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {g}
                </div>
                {groups[g].map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center rounded-lg text-sm transition-colors hover:bg-sidebar-accent",
                      params.threadId === t.id && "bg-sidebar-accent",
                    )}
                  >
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: t.id }}
                      onClick={onNavigate}
                      className="min-w-0 flex-1 truncate px-3 py-2"
                    >
                      {t.title}
                    </Link>
                    <button
                      type="button"
                      aria-label={tz("删除对话")}
                      onClick={() => void remove(t.id).catch(() => {})}
                      className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-100 transition hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ),
        )}
      </nav>
      <Link to="/brain" onClick={onNavigate} className="mx-2 mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"><BrainCircuitIcon className="size-4" />Smart Brain</Link>
      <AccountProfile user={user} onSignOut={signOut} isAdmin={isAdmin} />
    </div>
  );
}

function ChatLayout() {
  const [open, setOpen] = useState(false);
  const { user } = Route.useRouteContext();
  // Swiping right from the left edge opens the Bot list instead of feeling like "back".
  useEffect(() => {
    let startX = -1, startY = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t && t.clientX < 40 ? t.clientX : -1;
      startY = t?.clientY ?? 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startX < 0) return;
      const t = e.touches[0];
      if (t && t.clientX - startX > 50 && Math.abs(t.clientY - startY) < 40) { startX = -1; setOpen(true); }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchmove", onMove); };
  }, []);
  return (
    <ModeProvider>
      <WebSearchProvider>
      <BotPresenceProvider key={user.id} scope={user.id}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
          <Sidebar />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border p-0">
            <SheetTitle className="sr-only">{tz("会话列表")}</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="relative flex min-w-0 flex-1 flex-col bg-glow">
          <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
            <button
              type="button"
              aria-label={tz("打开会话列表")}
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
            >
              <MenuIcon className="size-5" />
            </button>
            <span className="text-sm font-semibold">Oxford Bot</span>
            <Link to="/chat" aria-label={tz("新建对话")} className="ml-auto rounded-lg p-2 text-muted-foreground hover:text-foreground">
              <PenSquareIcon className="size-5" />
            </Link>
          </header>
          <div className="min-h-0 flex-1">
            <Outlet />
          </div>
        </main>
      </div>
      </BotPresenceProvider>
      </WebSearchProvider>
    </ModeProvider>
  );
}

function useAdminFlag() {
  const check = useServerFn(checkAdmin);
  const { data } = useQuery({ queryKey: ["admin-check"], queryFn: () => check(), staleTime: 300_000 });
  return Boolean(data?.isAdmin);
}

