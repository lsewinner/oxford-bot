import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import british from "@/assets/cat-british.webp";
import ragdoll from "@/assets/cat-ragdoll.webp";
import bengal from "@/assets/cat-bengal.webp";
import tuxedo from "@/assets/cat-tuxedo.webp";
import maineCoon from "@/assets/cat-maine-coon.webp";
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

const cats = {
  mail: { src: british, breed: "英国短毛猫" },
  document: { src: ragdoll, breed: "布偶猫" },
  code: { src: bengal, breed: "孟加拉猫" },
  team: { src: tuxedo, breed: "黑白猫" },
  general: { src: maineCoon, breed: "缅因猫" },
};

export function BotAvatar({ bot, working = false }: { bot: BotIdentity; working?: boolean }) {
  const cat = cats[bot.kind];
  return <img src={cat.src} alt={`${bot.name} · ${cat.breed}`} title={cat.breed} width={36} height={36} loading="lazy" className={cn("size-9 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border", working && "bot-working")} />;
}

export function BotPresenceLabel({ bot, status = "ready" }: { bot: BotIdentity; status?: BotActivity["status"] }) {
  const working = botIsWorking(status);
  return <>
    <BotAvatar bot={bot} working={working} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{bot.name}</span>
      <span role="status" className="block truncate text-[11px] text-muted-foreground">
        {status === "submitted" ? "正在思考" : status === "streaming" ? "正在回复" : status === "error" ? "回复中断" : "会话助手"}
      </span>
    </span>
  </>;
}