import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { LogOutIcon, MenuIcon, PenSquareIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { threadsQuery, type Thread } from "@/lib/chat-data";
import { cn } from "@/lib/utils";
import { BotPresenceLabel, BotPresenceProvider, BotSettings, useBotPresence } from "@/components/chat/bot-presence";
import { botFromRequest, type BotActivity, type BotEntry, type BotIdentity } from "@/lib/bot-presence";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Oxford Bot · 对话" },
      { name: "description", content: "与 Oxford Bot 对话，支持 Fun / Normal 模式与代码高亮。" },
      { property: "og:title", content: "Oxford Bot · 对话" },
      { property: "og:description", content: "与 Oxford Bot 对话，支持 Fun / Normal 模式与代码高亮。" },
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
  if (diff <= 0) return "今天";
  if (diff <= 1) return "昨天";
  if (diff <= 7) return "过去 7 天";
  return "更早";
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: threads = [] } = useQuery(threadsQuery());
  const params = useParams({ strict: false }) as { threadId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const { activities, entries } = useBotPresence();
  const bots = threads.flatMap<{ thread: Thread; entry: BotEntry | null; bot: BotIdentity; status: BotActivity["status"] }>((thread) => {
    const registered = entries.filter((entry) => entry.threadId === thread.id);
    if (registered.length) return registered.map((entry, index) => ({ thread, entry, bot: entry.bot, status: index === registered.length - 1 ? activities[thread.id]?.status ?? "ready" as const : "ready" as const }));
    const bot = activities[thread.id]?.bot ?? botFromRequest(thread.title);
    return bot ? [{ thread, entry: null, bot, status: activities[thread.id]?.status ?? "ready" as const }] : [];
  });

  const groups = threads.filter((t) => !bots.some((b) => b.thread.id === t.id)).reduce<Record<string, Thread[]>>((acc, t) => {
    (acc[groupLabel(t.updated_at)] ??= []).push(t);
    return acc;
  }, {});

  const remove = async (id: string) => {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("删除失败");
      return;
    }
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
        <span className="text-[15px] font-semibold tracking-tight">Oxford Bot</span>
      </div>
      <div className="px-3">
        <Link
          to="/chat"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
        >
          <PenSquareIcon className="size-4" /> 新建对话
        </Link>
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
        {bots.length > 0 && <section aria-label="我的 Bots" className="mb-5">
          <div className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">我的 Bots</div>
          {bots.map(({ thread, entry, bot, status }) => <div key={entry?.id ?? thread.id} className={cn("group flex items-center rounded-lg hover:bg-sidebar-accent", params.threadId === thread.id && "bg-sidebar-accent")}>
            <Link to="/chat/$threadId" params={{ threadId: thread.id }} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2" aria-label={`打开 ${bot.name}`}>
              <BotPresenceLabel bot={bot} status={status} />
            </Link>
            {entry && <BotSettings entry={entry} />}
            <Button variant="ghost" size="icon-sm" aria-label={`删除 ${bot.name} 会话`} onClick={() => remove(thread.id)} className="mr-1 shrink-0 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"><Trash2Icon /></Button>
          </div>)}
        </section>}
        {threads.length === 0 && <p className="px-3 text-xs text-muted-foreground">还没有对话</p>}
        {["今天", "昨天", "过去 7 天", "更早"].map(
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
                      aria-label="删除对话"
                      onClick={() => remove(t.id)}
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
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        <button
          type="button"
          onClick={signOut}
          aria-label="退出登录"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        >
          <LogOutIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ChatLayout() {
  const [open, setOpen] = useState(false);
  return (
    <ModeProvider>
      <WebSearchProvider>
      <BotPresenceProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
          <Sidebar />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border p-0">
            <SheetTitle className="sr-only">会话列表</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="relative flex min-w-0 flex-1 flex-col bg-glow">
          <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
            <button
              type="button"
              aria-label="打开会话列表"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
            >
              <MenuIcon className="size-5" />
            </button>
            <span className="text-sm font-semibold">Oxford Bot</span>
            <Link to="/chat" aria-label="新建对话" className="ml-auto rounded-lg p-2 text-muted-foreground hover:text-foreground">
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
