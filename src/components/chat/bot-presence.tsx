import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { BotIcon, FileTextIcon, MailIcon, CodeXmlIcon, MessagesSquareIcon } from "lucide-react";
import { botIsWorking, type BotActivity, type BotIdentity } from "@/lib/bot-presence";
import { cn } from "@/lib/utils";

type PresenceContext = { activities: Record<string, BotActivity>; report: (id: string, activity: BotActivity) => void; settle: (id: string) => void };
const noop = () => {};
const Context = createContext<PresenceContext>({ activities: {}, report: noop, settle: noop });

export function BotPresenceProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Record<string, BotActivity>>({});
  const report = useCallback((id: string, activity: BotActivity) => {
    setActivities((prev) => ({ ...prev, [id]: activity }));
  }, []);
  const settle = useCallback((id: string) => {
    setActivities((prev) => {
      const current = prev[id];
      return current ? { ...prev, [id]: { ...current, status: "ready" } } : prev;
    });
  }, []);
  const value = useMemo(() => ({ activities, report, settle }), [activities, report, settle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useBotPresence = () => useContext(Context);

const icons = { mail: MailIcon, document: FileTextIcon, code: CodeXmlIcon, team: MessagesSquareIcon, general: BotIcon };

export function BotPresenceLabel({ bot, status = "ready" }: { bot: BotIdentity; status?: BotActivity["status"] }) {
  const Icon = icons[bot.kind];
  const working = botIsWorking(status);
  return <>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent">
      <Icon aria-hidden="true" className={cn("size-4 text-sidebar-foreground", working && "bot-working")} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{bot.name}</span>
      <span role="status" className="block truncate text-[11px] text-muted-foreground">
        {status === "submitted" ? "正在思考" : status === "streaming" ? "正在回复" : status === "error" ? "回复中断" : "会话助手"}
      </span>
    </span>
  </>;
}