import { tz } from "@/lib/i18n";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Settings2Icon, CheckIcon, PlusIcon, Share2Icon, CopyIcon, Trash2Icon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createBotShare, listMyBotShares, revokeBotShare } from "@/lib/bot-shares.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { TOOL_CATALOG } from '@/lib/tool-catalog';
import type { ProviderId } from '@/lib/connections/catalog';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { botIsWorking, botStorageKey, parseBotEntries, mergeBotEntries, type BotEntry, type CatBreed, type BotActivity, type BotIdentity, type BotKind } from "@/lib/bot-presence";
import { catBreeds, catIntros } from "@/lib/cat-breeds";
import { BotListLabel } from "@/components/chat/bot-list-label";
import { cn } from "@/lib/utils";
import { usePro } from "@/components/pro/pro-context";
import { canAddBot } from "@/lib/pro";
import { supabase } from "@/integrations/supabase/client";

type PresenceContext = { entries: BotEntry[]; register: (entries: BotEntry[]) => void; update: (id: string, bot: BotIdentity) => void; removeThread: (id: string) => void; hideEntry: (id: string) => void; linkConversation: (id: string, conversationId: string) => void; activities: Record<string, BotActivity>; report: (id: string, activity: BotActivity) => void; settle: (id: string) => void };
const noop = () => {};
const Context = createContext<PresenceContext>({ entries: [], register: noop, update: noop, removeThread: noop, hideEntry: noop, linkConversation: noop, activities: {}, report: noop, settle: noop });

export function BotPresenceProvider({ children, scope = "guest" }: { children: ReactNode; scope?: string }) {
  // Reset all registry state before restoring a different account's storage.
  return <ScopedBotPresenceProvider key={scope} scope={scope}>{children}</ScopedBotPresenceProvider>;
}

function ScopedBotPresenceProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const [restored, setRestored] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const cloud = scope !== "guest";
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = parseBotEntries(localStorage.getItem(botStorageKey(scope)));
      setEntries((current) => mergeBotEntries(saved, current));
    } catch { toast.error(tz("无法保存 Bot，请允许浏览器使用本地存储")); }
    setRestored(true);
    if (!cloud) return;
    // Signed-in Bots sync across devices; local copies migrate up on first load.
    void Promise.resolve(supabase.from("user_bot_registry" as never).select("entries").eq("user_id", scope).maybeSingle())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("bot cloud load failed", error); return; }
        const remote = parseBotEntries(JSON.stringify((data as { entries?: unknown } | null)?.entries ?? []));
        setEntries((current) => mergeBotEntries(remote, current));
        setCloudReady(true);
      }, () => {});
    return () => { cancelled = true; };
  }, [scope, cloud]);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(botStorageKey(scope), JSON.stringify(entries)); }
    catch { toast.error(tz("Bot 暂未保存，请检查浏览器存储空间")); }
  }, [entries, restored, scope]);
  useEffect(() => {
    if (!cloudReady) return;
    const timer = setTimeout(() => {
      void supabase.from("user_bot_registry" as never)
        .upsert({ user_id: scope, entries, updated_at: new Date().toISOString() } as never, { onConflict: "user_id" })
        .then(({ error }) => { if (error) console.error("bot cloud sync failed", error); });
    }, 600);
    return () => clearTimeout(timer);
  }, [entries, cloudReady, scope]);
  const register = useCallback((incoming: BotEntry[]) => {
    setEntries((previous) => {
      return mergeBotEntries(previous, incoming);
    });
  }, []);
  const update = useCallback((id: string, bot: BotIdentity) => {
    setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, bot, overrides: { name: bot.name, ...(bot.breed ? { breed: bot.breed } : {}) } } : entry));
  }, []);
  const removeThread = useCallback((id: string) => setEntries((previous) => previous.filter((entry) => entry.conversationId !== id && entry.threadId !== id)), []);
  // Deleted Bots stay as hidden tombstones so history parsing cannot resurrect them.
  const hideEntry = useCallback((id: string) => setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, hidden: true as const } : entry)), []);
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
  const visible = useMemo(() => entries.filter((entry) => !entry.hidden), [entries]);
  const value = useMemo(() => ({ entries: visible, register, update, removeThread, hideEntry, linkConversation, activities, report, settle }), [visible, register, update, removeThread, hideEntry, linkConversation, activities, report, settle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useBotPresence = () => useContext(Context);

const images = import.meta.glob("/src/assets/cat-*.webp", { eager: true, import: "default" }) as Record<string, string>;

function CatPicker({ bot, breed, onChange }: { bot: BotIdentity; breed: CatBreed; onChange: (breed: CatBreed) => void }) {
  const [search, setSearch] = useState("");
  return <fieldset className="min-h-0"><legend className="mb-3 text-sm">{tz("猫咪品种 ·")} {catBreeds.length}</legend>
    <Input aria-label={tz("搜索猫咪品种")} placeholder={tz("搜索品种或性格，如：粘人、安静…")} value={search} onChange={(event) => setSearch(event.target.value)} className="mb-3" />
    <div className="grid max-h-[40dvh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">{catBreeds.filter((cat) => cat.name.includes(search) || catIntros[cat.id].includes(search)).map((cat) => <Button key={cat.id} type="button" variant="outline" aria-label={cat.name} title={catIntros[cat.id]} aria-pressed={breed === cat.id} onClick={() => onChange(cat.id)} className={cn("relative h-24 flex-col gap-2 px-1 py-2", breed === cat.id && "border-primary bg-accent")}><BotAvatar bot={{ ...bot, breed: cat.id }} /><span className="whitespace-normal text-center text-[11px] leading-4">{cat.name}</span>{breed === cat.id && <CheckIcon className="absolute right-1 top-1 size-3" />}</Button>)}</div>
    <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><span className="text-foreground">{catBreeds.find((c) => c.id === breed)?.name}</span> · {catIntros[breed]}</p>
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
    <Button size="sm" variant="ghost" aria-label={tz("新建 Bot")} className="h-7 gap-1 px-2 text-xs" onClick={() => { if (!canAddBot(isPro, entries.length) && !requirePro("bot")) return; setName(""); setKind("general"); setBreed("general"); setOpen(true); }}><PlusIcon className="size-3.5" />{tz("新建")}</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{tz("新建 Bot")}</DialogTitle></DialogHeader>
      <form className="space-y-5" onSubmit={async (event) => { event.preventDefault(); if (!name.trim() || saving) return; setSaving(true); try { await onCreate({ name: name.trim(), kind, breed }); setOpen(false); } catch { toast.error(tz("创建 Bot 失败，请重试")); } finally { setSaving(false); } }}>
        <div className="space-y-2"><label htmlFor="new-bot-name" className="text-sm">{tz("名字")}</label><Input id="new-bot-name" value={name} required maxLength={40} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="new-bot-kind" className="text-sm">{tz("职能")}</label><select id="new-bot-kind" value={kind} onChange={(event) => { const next = event.target.value as BotKind; setKind(next); setBreed(next); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="general">{tz("通用任务")}</option><option value="mail">{tz("邮件助手")}</option><option value="document">{tz("文档助手")}</option><option value="code">{tz("网站与代码")}</option><option value="team">{tz("协作助手")}</option></select></div>
        <CatPicker bot={{ name: name || tz("新 Bot"), kind }} breed={breed} onChange={setBreed} />
        <DialogFooter><Button type="submit" disabled={saving || !name.trim()}>{saving ? tz("正在创建…") : tz("创建 Bot")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BotAvatar({ bot, working = false }: { bot: BotIdentity; working?: boolean }) {
  const cat = catBreeds.find((item) => item.id === (bot.breed ?? bot.kind)) ?? catBreeds[0];
  return <img src={images[`/src/assets/cat-${cat.asset}.webp`]} alt={`${bot.name} · ${cat.name}`} title={cat.name} width={32} height={32} loading="lazy" className={cn("size-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border", working && "bot-working")} />;
}

export function BotSettings({ entry, onRename, onDelete }: { entry: BotEntry; onRename?: (name: string) => Promise<void>; onDelete?: () => Promise<void> | void }) {
  const { update, hideEntry } = useBotPresence();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.bot.name);
  const [breed, setBreed] = useState<CatBreed>(entry.bot.breed ?? entry.bot.kind);
  const [systemPrompt,setSystemPrompt]=useState(entry.bot.systemPrompt ?? '');
  const [preferredTools,setPreferredTools]=useState<ProviderId[]>(entry.bot.preferredTools ?? []);
  const [saving, setSaving] = useState(false);
  const { isPro, openUpgrade } = usePro();
  const shareBot = useServerFn(createBotShare);
  const [intro, setIntro] = useState('');
  const [sharing, setSharing] = useState(false);
  const listShares = useServerFn(listMyBotShares);
  const revokeShare = useServerFn(revokeBotShare);
  const [shares, setShares] = useState<{ token: string; name: string; created_at: string }[]>([]);
  const refreshShares = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setShares([]); return; }
    try { setShares(await listShares()); } catch { /* list is optional */ }
  }, [listShares]);
  useEffect(() => { if (open) void refreshShares(); }, [open, refreshShares]);
  const linkFor = (token: string) => `${window.location.origin}/b/${token}`;
  const revokeOne = async (token: string) => {
    if (!window.confirm(tz("撤销后该链接立即失效，确定撤销吗？"))) return;
    try { await revokeShare({ data: { token } }); setShares(items => items.filter(s => s.token !== token)); toast.success(tz("分享链接已撤销")); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("撤销失败")); }
  };
  const share = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { toast.error(tz("登录后才能分享 Bot")); return; }
    setSharing(true);
    try {
      const { token } = await shareBot({ data: { name: name.trim() || entry.bot.name, kind: entry.bot.kind, breed, ...(isPro && systemPrompt ? { systemPrompt } : {}), ...(intro.trim() ? { intro: intro.trim() } : {}) } });
      const url = linkFor(token);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success(tz("分享链接已复制"), { description: url });
      void refreshShares();
    } catch { toast.error(tz("创建分享链接失败，请重试")); }
    finally { setSharing(false); }
  };
  return <>
    <Button variant="ghost" size="icon-sm" title={tz("Bot 人设、职能与头像")} aria-label={tz("设置 {0}", entry.bot.name)} className="size-6 shrink-0 text-muted-foreground [&_svg]:size-3.5" onClick={() => { setName(entry.bot.name); setBreed(entry.bot.breed ?? entry.bot.kind); setSystemPrompt(entry.bot.systemPrompt ?? '');setPreferredTools(entry.bot.preferredTools ?? []);setOpen(true); }}><Settings2Icon /></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{tz("设置 Bot")}</DialogTitle></DialogHeader>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        update(entry.id, { ...entry.bot, name: name.trim(), breed, ...(isPro ? { systemPrompt, preferredTools } : {}) });
        try { await onRename?.(name.trim()); setOpen(false); }
        catch { toast.error(tz("Bot 设置已在本机保存，但会话标题同步失败，请重试保存")); }
        finally { setSaving(false); }
      }} className="space-y-5">
        <div className="space-y-2"><label htmlFor={`name-${entry.id}`} className="text-sm">{tz("名字")}</label><Input id={`name-${entry.id}`} value={name} maxLength={40} required onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor={`persona-${entry.id}`} className="text-sm">{tz("系统提示词 · 人设 / 说话风格 / 专注职能")}</label>{!isPro && <button type="button" onClick={() => openUpgrade("persona")} className="block text-xs text-muted-foreground underline">{tz("自定义人设为 Pro 权益 · 升级解锁")}</button>}<Textarea readOnly={!isPro} onFocus={() => { if (!isPro) openUpgrade("persona"); }} id={`persona-${entry.id}`} aria-label={tz("Bot 系统提示词")} value={systemPrompt} maxLength={8000} rows={5} onChange={e=>setSystemPrompt(e.target.value)} placeholder={tz("例如：你是一位严谨的技术顾问，用简洁中文回答，专注代码审查与架构分析。")}/></div>
        <fieldset><legend className="mb-3 text-sm">{tz("默认工具偏好")}</legend><div className="grid grid-cols-2 gap-3">{TOOL_CATALOG.map(tool=><label key={tool.id} className="flex items-center gap-2 text-sm"><Checkbox checked={preferredTools.includes(tool.id)} onCheckedChange={checked=>setPreferredTools(prev=>checked?[...prev,tool.id]:prev.filter(id=>id!==tool.id))}/>{tool.name}</label>)}</div></fieldset>
        <CatPicker bot={{ ...entry.bot, name }} breed={breed} onChange={setBreed} />
        <fieldset className="space-y-2 rounded-md border border-border p-3"><legend className="px-1 text-sm">{tz("分享此 Bot")}</legend>
          <Input aria-label={tz("分享简介")} placeholder={tz("一句话介绍（可选），显示在分享页")} maxLength={200} value={intro} onChange={(e) => setIntro(e.target.value)} />
          <p className="text-xs text-muted-foreground">{tz("对方打开链接后可试聊或复制一份。只分享名字、头像")}{isPro ? tz("和人设") : ''}{tz("，绝不包含你的聊天记录、Smart Brain 资料、工具连接或账户信息。")}</p>
          <Button type="button" variant="outline" size="sm" disabled={sharing} onClick={share}><Share2Icon className="size-4" />{sharing ? tz("正在生成…") : tz("生成分享链接")}</Button>
          {shares.length > 0 && <div className="space-y-1 pt-2">
            <p className="text-xs text-muted-foreground">{tz("我已分享的 Bot 链接（撤销后立即失效）")}</p>
            <div className="max-h-48 overflow-auto">{shares.map(s => <div key={s.token} className="flex min-w-0 items-center gap-2 border-b border-border py-1.5">
              <a href={`/b/${s.token}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm">{s.name} · <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span></a>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={tz("复制分享链接")} title={tz("复制链接")} onClick={() => { void navigator.clipboard.writeText(linkFor(s.token)).then(() => toast.success(tz("已复制"))).catch(() => toast.error(tz("复制失败"))); }}><CopyIcon className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={tz("撤销分享链接")} title={tz("撤销分享")} onClick={() => void revokeOne(s.token)}><Trash2Icon className="size-4" /></Button>
            </div>)}</div>
          </div>}
        </fieldset>
        <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="ghost" className="text-destructive" disabled={saving} onClick={async () => {
          if (!window.confirm(tz("确定删除「{0}」吗？它的对话也会一起删除。", entry.bot.name))) return;
          try { await onDelete?.(); hideEntry(entry.id); setOpen(false); toast.success(tz("Bot 已删除")); } catch { toast.error(tz("删除 Bot 失败，请重试")); }
        }}><Trash2Icon className="size-4" />{tz("删除 Bot")}</Button><Button type="submit" disabled={!name.trim() || saving}>{saving ? tz("正在保存…") : tz("保存")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BotPresenceLabel({ bot, status = "ready", preview, time }: { bot: BotIdentity; status?: BotActivity["status"] | undefined; preview?: string | undefined; time?: string | undefined }) {
  const working = botIsWorking(status);
  const line = status === "submitted" ? tz("正在思考…") : status === "streaming" ? tz("正在回复…") : status === "error" ? tz("回复中断") : preview || tz("还没有消息");
  return <BotListLabel avatar={<BotAvatar bot={bot} working={working} />} name={bot.name} preview={line} time={time} />;
}
