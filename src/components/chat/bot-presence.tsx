import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Settings2Icon, CheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { botIsWorking, botStorageKey, parseBotEntries, mergeBotEntries, type BotEntry, type CatBreed, type BotActivity, type BotIdentity, type BotKind } from "@/lib/bot-presence";
import { catBreeds } from "@/lib/cat-breeds";
import { cn } from "@/lib/utils";

type PresenceContext = { entries: BotEntry[]; register: (entries: BotEntry[]) => void; update: (id: string, bot: BotIdentity) => void; removeThread: (id: string) => void; linkConversation: (id: string, conversationId: string) => void; activities: Record<string, BotActivity>; report: (id: string, activity: BotActivity) => void; settle: (id: string) => void };
const noop = () => {};
const Context = createContext<PresenceContext>({ entries: [], register: noop, update: noop, removeThread: noop, linkConversation: noop, activities: {}, report: noop, settle: noop });

export function BotPresenceProvider({ children, scope = "guest" }: { children: ReactNode; scope?: string }) {
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = parseBotEntries(localStorage.getItem(botStorageKey(scope)));
      setEntries((current) => mergeBotEntries(saved, current));
    } catch { toast.error("无法保存 Bot，请允许浏览器使用本地存储"); }
    setRestored(true);
  }, [scope]);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(botStorageKey(scope), JSON.stringify(entries)); }
    catch { toast.error("Bot 暂未保存，请检查浏览器存储空间"); }
  }, [entries, restored, scope]);
  const register = useCallback((incoming: BotEntry[]) => {
    setEntries((previous) => {
      const merged = mergeBotEntries(previous, incoming);
      return merged.length === previous.length ? previous : merged;
    });
  }, []);
  const update = useCallback((id: string, bot: BotIdentity) => {
    setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, bot } : entry));
  }, []);
  const removeThread = useCallback((id: string) => setEntries((previous) => previous.filter((entry) => entry.conversationId !== id && entry.threadId !== id)), []);
  const linkConversation = useCallback((id: string, conversationId: string) => setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, conversationId } : entry)), []);
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
  const value = useMemo(() => ({ entries, register, update, removeThread, linkConversation, activities, report, settle }), [entries, register, update, removeThread, linkConversation, activities, report, settle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useBotPresence = () => useContext(Context);

const images = import.meta.glob("/src/assets/cat-*.webp", { eager: true, import: "default" }) as Record<string, string>;

function CatPicker({ bot, breed, onChange }: { bot: BotIdentity; breed: CatBreed; onChange: (breed: CatBreed) => void }) {
  const [search, setSearch] = useState("");
  return <fieldset className="min-h-0"><legend className="mb-3 text-sm">猫咪品种 · {catBreeds.length}</legend>
    <Input aria-label="搜索猫咪品种" placeholder="搜索品种…" value={search} onChange={(event) => setSearch(event.target.value)} className="mb-3" />
    <div className="grid max-h-[40dvh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">{catBreeds.filter((cat) => cat.name.includes(search)).map((cat) => <Button key={cat.id} type="button" variant="outline" aria-label={cat.name} aria-pressed={breed === cat.id} onClick={() => onChange(cat.id)} className={cn("relative h-24 flex-col gap-2 px-1 py-2", breed === cat.id && "border-primary bg-accent")}><BotAvatar bot={{ ...bot, breed: cat.id }} /><span className="whitespace-normal text-center text-[11px] leading-4">{cat.name}</span>{breed === cat.id && <CheckIcon className="absolute right-1 top-1 size-3" />}</Button>)}</div>
  </fieldset>;
}

export function NewBot({ onCreate }: { onCreate: (bot: BotIdentity) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BotKind>("general");
  const [breed, setBreed] = useState<CatBreed>("general");
  const [saving, setSaving] = useState(false);
  return <>
    <Button size="sm" variant="ghost" aria-label="新建 Bot" className="h-7 gap-1 px-2 text-xs" onClick={() => { setName(""); setKind("general"); setBreed("general"); setOpen(true); }}><PlusIcon className="size-3.5" />新建</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>新建 Bot</DialogTitle></DialogHeader>
      <form className="space-y-5" onSubmit={async (event) => { event.preventDefault(); if (!name.trim() || saving) return; setSaving(true); try { await onCreate({ name: name.trim(), kind, breed }); setOpen(false); } catch { toast.error("创建 Bot 失败，请重试"); } finally { setSaving(false); } }}>
        <div className="space-y-2"><label htmlFor="new-bot-name" className="text-sm">名字</label><Input id="new-bot-name" value={name} required maxLength={40} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="new-bot-kind" className="text-sm">职能</label><select id="new-bot-kind" value={kind} onChange={(event) => { const next = event.target.value as BotKind; setKind(next); setBreed(next); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="general">通用任务</option><option value="mail">邮件助手</option><option value="document">文档助手</option><option value="code">网站与代码</option><option value="team">协作助手</option></select></div>
        <CatPicker bot={{ name: name || "新 Bot", kind }} breed={breed} onChange={setBreed} />
        <DialogFooter><Button type="submit" disabled={saving || !name.trim()}>{saving ? "正在创建…" : "创建 Bot"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BotAvatar({ bot, working = false }: { bot: BotIdentity; working?: boolean }) {
  const cat = catBreeds.find((item) => item.id === (bot.breed ?? bot.kind)) ?? catBreeds[0];
  return <img src={images[`/src/assets/cat-${cat.asset}.webp`]} alt={`${bot.name} · ${cat.name}`} title={cat.name} width={36} height={36} loading="lazy" className={cn("size-9 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border", working && "bot-working")} />;
}

export function BotSettings({ entry }: { entry: BotEntry }) {
  const { update } = useBotPresence();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.bot.name);
  const [breed, setBreed] = useState<CatBreed>(entry.bot.breed ?? entry.bot.kind);
  return <>
    <Button variant="ghost" size="icon-sm" title="修改名字和猫咪头像" aria-label={`设置 ${entry.bot.name}`} className="mr-1 shrink-0 text-muted-foreground" onClick={() => { setName(entry.bot.name); setBreed(entry.bot.breed ?? entry.bot.kind); setOpen(true); }}><Settings2Icon /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>设置 Bot</DialogTitle></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; update(entry.id, { ...entry.bot, name: name.trim(), breed }); setOpen(false); }} className="space-y-5">
        <div className="space-y-2"><label htmlFor={`name-${entry.id}`} className="text-sm">名字</label><Input id={`name-${entry.id}`} value={name} maxLength={40} required onChange={(event) => setName(event.target.value)} /></div>
        <CatPicker bot={{ ...entry.bot, name }} breed={breed} onChange={setBreed} />
        <DialogFooter><Button type="submit" disabled={!name.trim()}>保存</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BotPresenceLabel({ bot, status = "ready", preview }: { bot: BotIdentity; status?: BotActivity["status"]; preview?: string }) {
  const working = botIsWorking(status);
  const line = status === "submitted" ? "正在思考…" : status === "streaming" ? "正在回复…" : status === "error" ? "回复中断" : preview || "还没有消息";
  return <>
    <BotAvatar bot={bot} working={working} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{bot.name}</span>
      <span role="status" className="block truncate text-[11px] text-muted-foreground">{line}</span>
    </span>
  </>;
}