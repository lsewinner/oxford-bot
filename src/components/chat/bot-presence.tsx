import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Settings2Icon, CheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { TOOL_CATALOG } from '@/lib/tool-catalog';
import type { ProviderId } from '@/lib/connections/catalog';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { botIsWorking, botStorageKey, parseBotEntries, mergeBotEntries, type BotEntry, type CatBreed, type BotActivity, type BotIdentity, type BotKind } from "@/lib/bot-presence";
import { catBreeds } from "@/lib/cat-breeds";
import { BotListLabel } from "@/components/chat/bot-list-label";
import { cn } from "@/lib/utils";
import { usePro } from "@/components/pro/pro-context";
import { canAddBot } from "@/lib/pro";
import { supabase } from "@/integrations/supabase/client";

type PresenceContext = { entries: BotEntry[]; register: (entries: BotEntry[]) => void; update: (id: string, bot: BotIdentity) => void; removeThread: (id: string) => void; linkConversation: (id: string, conversationId: string) => void; activities: Record<string, BotActivity>; report: (id: string, activity: BotActivity) => void; settle: (id: string) => void };
const noop = () => {};
const Context = createContext<PresenceContext>({ entries: [], register: noop, update: noop, removeThread: noop, linkConversation: noop, activities: {}, report: noop, settle: noop });

export function BotPresenceProvider({ children, scope = "guest" }: { children: ReactNode; scope?: string }) {
  // Reset all registry state before restoring a different account's storage.
  return <ScopedBotPresenceProvider key={scope} scope={scope}>{children}</ScopedBotPresenceProvider>;
}

function ScopedBotPresenceProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const [restored, setRestored] = useState(false);
  const cloud = scope !== "guest";
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = parseBotEntries(localStorage.getItem(botStorageKey(scope)));
      setEntries((current) => mergeBotEntries(saved, current));
    } catch { toast.error("无法保存 Bot，请允许浏览器使用本地存储"); }
    if (!cloud) { setRestored(true); return; }
    // Signed-in Bots sync across devices; local copies migrate up on first load.
    void supabase.from("user_bot_registry" as never).select("entries").eq("user_id", scope).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error("云端 Bot 同步失败，先使用本机记录");
        const remote = parseBotEntries(JSON.stringify((data as { entries?: unknown } | null)?.entries ?? []));
        setEntries((current) => mergeBotEntries(remote, current));
        setRestored(true);
      });
    return () => { cancelled = true; };
  }, [scope, cloud]);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(botStorageKey(scope), JSON.stringify(entries)); }
    catch { toast.error("Bot 暂未保存，请检查浏览器存储空间"); }
    if (!cloud) return;
    const timer = setTimeout(() => {
      void supabase.from("user_bot_registry" as never)
        .upsert({ user_id: scope, entries, updated_at: new Date().toISOString() } as never, { onConflict: "user_id" })
        .then(({ error }) => { if (error) console.error("bot cloud sync failed", error); });
    }, 600);
    return () => clearTimeout(timer);
  }, [entries, restored, scope, cloud]);
  const register = useCallback((incoming: BotEntry[]) => {
    setEntries((previous) => {
      return mergeBotEntries(previous, incoming);
    });
  }, []);
  const update = useCallback((id: string, bot: BotIdentity) => {
    setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, bot, overrides: { name: bot.name, ...(bot.breed ? { breed: bot.breed } : {}) } } : entry));
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
  const { isPro, requirePro } = usePro();
  const { entries } = useBotPresence();
  return <>
    <Button size="sm" variant="ghost" aria-label="新建 Bot" className="h-7 gap-1 px-2 text-xs" onClick={() => { if (!canAddBot(isPro, entries.length) && !requirePro("bot")) return; setName(""); setKind("general"); setBreed("general"); setOpen(true); }}><PlusIcon className="size-3.5" />新建</Button>
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
  return <img src={images[`/src/assets/cat-${cat.asset}.webp`]} alt={`${bot.name} · ${cat.name}`} title={cat.name} width={32} height={32} loading="lazy" className={cn("size-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border", working && "bot-working")} />;
}

export function BotSettings({ entry, onRename }: { entry: BotEntry; onRename?: (name: string) => Promise<void> }) {
  const { update } = useBotPresence();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.bot.name);
  const [breed, setBreed] = useState<CatBreed>(entry.bot.breed ?? entry.bot.kind);
  const [systemPrompt,setSystemPrompt]=useState(entry.bot.systemPrompt ?? '');
  const [preferredTools,setPreferredTools]=useState<ProviderId[]>(entry.bot.preferredTools ?? []);
  const [saving, setSaving] = useState(false);
  const { isPro, openUpgrade } = usePro();
  return <>
    <Button variant="ghost" size="icon-sm" title="Bot 人设、职能与头像" aria-label={`设置 ${entry.bot.name}`} className="size-6 shrink-0 text-muted-foreground [&_svg]:size-3.5" onClick={() => { setName(entry.bot.name); setBreed(entry.bot.breed ?? entry.bot.kind); setSystemPrompt(entry.bot.systemPrompt ?? '');setPreferredTools(entry.bot.preferredTools ?? []);setOpen(true); }}><Settings2Icon /></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>设置 Bot</DialogTitle></DialogHeader>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        update(entry.id, { ...entry.bot, name: name.trim(), breed, ...(isPro ? { systemPrompt, preferredTools } : {}) });
        try { await onRename?.(name.trim()); setOpen(false); }
        catch { toast.error("Bot 设置已在本机保存，但会话标题同步失败，请重试保存"); }
        finally { setSaving(false); }
      }} className="space-y-5">
        <div className="space-y-2"><label htmlFor={`name-${entry.id}`} className="text-sm">名字</label><Input id={`name-${entry.id}`} value={name} maxLength={40} required onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor={`persona-${entry.id}`} className="text-sm">系统提示词 · 人设 / 说话风格 / 专注职能</label>{!isPro && <button type="button" onClick={() => openUpgrade("persona")} className="block text-xs text-muted-foreground underline">自定义人设为 Pro 权益 · 升级解锁</button>}<Textarea readOnly={!isPro} onFocus={() => { if (!isPro) openUpgrade("persona"); }} id={`persona-${entry.id}`} aria-label="Bot 系统提示词" value={systemPrompt} maxLength={8000} rows={5} onChange={e=>setSystemPrompt(e.target.value)} placeholder="例如：你是一位严谨的技术顾问，用简洁中文回答，专注代码审查与架构分析。"/></div>
        <fieldset><legend className="mb-3 text-sm">默认工具偏好</legend><div className="grid grid-cols-2 gap-3">{TOOL_CATALOG.map(tool=><label key={tool.id} className="flex items-center gap-2 text-sm"><Checkbox checked={preferredTools.includes(tool.id)} onCheckedChange={checked=>setPreferredTools(prev=>checked?[...prev,tool.id]:prev.filter(id=>id!==tool.id))}/>{tool.name}</label>)}</div></fieldset>
        <CatPicker bot={{ ...entry.bot, name }} breed={breed} onChange={setBreed} />
        <DialogFooter><Button type="submit" disabled={!name.trim() || saving}>{saving ? "正在保存…" : "保存"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BotPresenceLabel({ bot, status = "ready", preview, time }: { bot: BotIdentity; status?: BotActivity["status"] | undefined; preview?: string | undefined; time?: string | undefined }) {
  const working = botIsWorking(status);
  const line = status === "submitted" ? "正在思考…" : status === "streaming" ? "正在回复…" : status === "error" ? "回复中断" : preview || "还没有消息";
  return <BotListLabel avatar={<BotAvatar bot={bot} working={working} />} name={bot.name} preview={line} time={time} />;
}
