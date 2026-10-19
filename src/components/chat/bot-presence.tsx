import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Settings2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import british from "@/assets/cat-british.webp";
import ragdoll from "@/assets/cat-ragdoll.webp";
import bengal from "@/assets/cat-bengal.webp";
import tuxedo from "@/assets/cat-tuxedo.webp";
import maineCoon from "@/assets/cat-maine-coon.webp";
import { botIsWorking, mergeBotEntries, type BotEntry, type CatBreed, type BotActivity, type BotIdentity } from "@/lib/bot-presence";
import { cn } from "@/lib/utils";

type PresenceContext = { entries: BotEntry[]; register: (entries: BotEntry[]) => void; update: (id: string, bot: BotIdentity) => void; activities: Record<string, BotActivity>; report: (id: string, activity: BotActivity) => void; settle: (id: string) => void };
const noop = () => {};
const Context = createContext<PresenceContext>({ entries: [], register: noop, update: noop, activities: {}, report: noop, settle: noop });

export function BotPresenceProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const register = useCallback((incoming: BotEntry[]) => {
    setEntries((previous) => {
      const merged = mergeBotEntries(previous, incoming);
      return merged.length === previous.length ? previous : merged;
    });
  }, []);
  const update = useCallback((id: string, bot: BotIdentity) => {
    setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, bot } : entry));
  }, []);
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
  const value = useMemo(() => ({ entries, register, update, activities, report, settle }), [entries, register, update, activities, report, settle]);
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
  const cat = cats[bot.breed ?? bot.kind];
  return <img src={cat.src} alt={`${bot.name} · ${cat.breed}`} title={cat.breed} width={36} height={36} loading="lazy" className={cn("size-9 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border", working && "bot-working")} />;
}

export function BotSettings({ entry }: { entry: BotEntry }) {
  const { update } = useBotPresence();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.bot.name);
  const [breed, setBreed] = useState<CatBreed>(entry.bot.breed ?? entry.bot.kind);
  return <>
    <Button variant="ghost" size="icon-sm" title="修改名字和猫咪头像" aria-label={`设置 ${entry.bot.name}`} className="mr-1 shrink-0 text-muted-foreground" onClick={() => { setName(entry.bot.name); setBreed(entry.bot.breed ?? entry.bot.kind); setOpen(true); }}><Settings2Icon /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>设置 Bot</DialogTitle></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; update(entry.id, { ...entry.bot, name: name.trim(), breed }); setOpen(false); }} className="space-y-5">
        <div className="space-y-2"><label htmlFor={`name-${entry.id}`} className="text-sm">名字</label><Input id={`name-${entry.id}`} value={name} maxLength={40} required onChange={(event) => setName(event.target.value)} /></div>
        <fieldset><legend className="mb-3 text-sm">猫咪品种</legend><div className="grid grid-cols-3 gap-2">{(Object.keys(cats) as CatBreed[]).map((key) => <Button key={key} variant="outline" type="button" aria-pressed={breed === key} aria-label={cats[key].breed} onClick={() => setBreed(key)} className={cn("relative h-auto flex-col gap-2 px-1 py-3", breed === key && "border-primary bg-accent")}>
          <BotAvatar bot={{ name, kind: entry.bot.kind, breed: key }} /><span className="text-[11px]">{cats[key].breed}</span>{breed === key && <CheckIcon className="absolute right-1 top-1 size-3" />}
        </Button>)}</div></fieldset>
        <DialogFooter><Button type="submit" disabled={!name.trim()}>保存</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
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