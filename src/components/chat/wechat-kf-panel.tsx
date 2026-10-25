import { tz } from "@/lib/i18n";
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { CopyIcon, LoaderCircleIcon, MessageCircleIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { listWechatKf, saveWechatKf, testWechatKf, updateWechatKf } from '@/lib/wechat-kf.functions';
import { usePro } from '@/components/pro/pro-context';

type Row = Awaited<ReturnType<typeof listWechatKf>>[number];
type BotOption = { name: string; prompt: string };
const empty = { id: '', label: '', corpId: '', secret: '', token: '', aesKey: '', openKfid: '', bot: 'Oxonian' };

export function WechatKfPanel({ signedIn }: { signedIn: boolean }) {
  const list = useServerFn(listWechatKf), save = useServerFn(saveWechatKf), update = useServerFn(updateWechatKf), test = useServerFn(testWechatKf);
  const { requirePro } = usePro();
  const [rows, setRows] = useState<Row[]>([]), [bots, setBots] = useState<BotOption[]>([{ name: 'Oxonian', prompt: '' }]);
  const [form, setForm] = useState<typeof empty | null>(null), [busy, setBusy] = useState(''), [info, setInfo] = useState<Record<string, { link: string; names: string }>>({});
  const refresh = async () => {
    if (!signedIn) { setRows([]); return; }
    try { setRows(await list()); } catch { /* shown as empty */ }
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from('user_bot_registry').select('entries').eq('user_id', uid).maybeSingle();
    const entries = Array.isArray(data?.entries) ? data.entries as { bot?: { name?: string; systemPrompt?: string }; overrides?: { name?: string } }[] : [];
    const names = entries.flatMap(e => e.bot?.name ? [{ name: e.overrides?.name || e.bot.name, prompt: e.bot.systemPrompt ?? '' }] : []);
    setBots([{ name: 'Oxonian', prompt: '' }, ...names.filter((b, i) => names.findIndex(x => x.name === b.name) === i && b.name !== 'Oxonian')]);
  };
  useEffect(() => { void refresh(); }, [signedIn]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => f && { ...f, [k]: e.target.value });
  const callback = (id: string) => `${window.location.origin}/api/public/wechat-kf/${id}`;
  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast.success(tz("已复制")); };

  const submit = async () => {
    if (!form) return;
    setBusy('save');
    try {
      const bot = bots.find(b => b.name === form.bot) ?? bots[0]!;
      const { id } = await save({ data: { ...(form.id ? { id: form.id } : {}), label: form.label, corpId: form.corpId, openKfid: form.openKfid, botName: bot.name, botPrompt: bot.prompt.slice(0, 8000), ...(form.secret ? { secret: form.secret } : {}), ...(form.token ? { token: form.token } : {}), ...(form.aesKey ? { aesKey: form.aesKey } : {}) } });
      setForm(null); await refresh();
      toast.success(tz("已保存，请把回调地址填入企业微信后台"));
      copy(callback(id));
    } catch (e) { toast.error(e instanceof Error && e.message.length < 80 ? e.message : tz("保存失败，请检查各项格式")); }
    finally { setBusy(''); }
  };
  const verify = async (id: string) => {
    setBusy(id);
    try { const r = await test({ data: { id } }); setInfo(i => ({ ...i, [id]: { link: r.link, names: r.accounts.map(a => a.name).join('、') } })); toast.success(tz("企业微信连接正常")); }
    catch (e) { toast.error(e instanceof Error ? e.message : tz("连接失败")); }
    finally { setBusy(''); }
  };
  const change = async (id: string, patch: { enabled?: boolean; remove?: boolean }) => { setBusy(id); try { await update({ data: { id, ...patch } }); await refresh(); } catch { toast.error(tz("更新失败")); } finally { setBusy(''); } };

  return <section className="border-t border-border pt-4">
    <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageCircleIcon className="size-4" />{tz("微信客服 · Bot 代你聊天")}</h2>
    <p className="text-xs text-muted-foreground">{tz("通过企业微信「微信客服」官方接口，让微信好友在微信里直接和你的猫咪 Bot 聊天。支持多个企业微信，每个可绑定不同 Bot。")}</p>
    {!signedIn ? <p className="mt-2 text-xs text-muted-foreground">{tz("登录后添加")}</p> : <>
      {rows.map(r => <div key={r.id} className="mt-2 space-y-2 rounded-md border border-border px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm">{r.label || r.corp_id} <span className="text-xs text-muted-foreground">· {r.bot_name}</span></span>
          <span className="flex items-center gap-2"><Switch aria-label={tz("启用自动回复")} checked={r.enabled} disabled={Boolean(busy)} onCheckedChange={v => void change(r.id, { enabled: v })} />
            <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void verify(r.id)}>{busy === r.id && <LoaderCircleIcon className="size-4 animate-spin" />}{tz("测试")}</Button>
            <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setForm({ ...empty, id: r.id, label: r.label, corpId: r.corp_id, openKfid: r.open_kfid, bot: r.bot_name })}>{tz("编辑")}</Button>
            <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => { if (confirm(tz("删除这个微信客服连接？"))) void change(r.id, { remove: true }); }}>{tz("删除")}</Button></span>
        </div>
        <button type="button" className="flex w-full items-center gap-2 text-left font-mono text-[11px] text-muted-foreground hover:text-foreground" onClick={() => copy(callback(r.id))}><CopyIcon className="size-3 shrink-0" /><span className="break-all">{tz("回调 URL：")}{callback(r.id)}</span></button>
        {info[r.id] && <div className="text-xs text-muted-foreground">{info[r.id]!.names && <p>{tz("客服账号：")}{info[r.id]!.names}</p>}{info[r.id]!.link && <button type="button" className="underline" onClick={() => copy(info[r.id]!.link)}>{tz("复制微信开聊链接（可生成二维码分享）")}</button>}</div>}
      </div>)}
      {form ? <div className="mt-3 space-y-2 rounded-lg border border-primary/40 p-3">
        <Input placeholder={tz("名称（如 牛津智能）")} value={form.label} maxLength={60} onChange={set('label')} />
        <Input placeholder={tz("企业 ID（CorpId，ww 开头）")} value={form.corpId} onChange={set('corpId')} />
        <Input placeholder={form.id ? tz("微信客服 Secret（留空不修改）") : tz("微信客服 Secret")} type="password" value={form.secret} onChange={set('secret')} />
        <Input placeholder={form.id ? tz("回调 Token（留空不修改）") : tz("回调 Token")} value={form.token} onChange={set('token')} />
        <Input placeholder={form.id ? tz("EncodingAESKey（留空不修改）") : tz("EncodingAESKey（43 位）")} value={form.aesKey} onChange={set('aesKey')} />
        <Input placeholder={tz("客服账号 ID（open_kfid，可选，wk 开头）")} value={form.openKfid} onChange={set('openKfid')} />
        <label className="block text-xs text-muted-foreground">由哪只 Bot 回复
          <select className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={form.bot} onChange={set('bot')}>{bots.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</select></label>
        <p className="text-xs text-muted-foreground">{tz("在企业微信后台「应用管理 → 微信客服」：复制 Secret；在「接收事件服务器」点随机获取 Token 和 EncodingAESKey 后粘贴到这里，保存后再把生成的回调 URL 填回后台。")}</p>
        <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setForm(null)}>{tz("取消")}</Button><Button size="sm" disabled={busy === 'save' || !form.corpId.trim()} onClick={() => void submit()}>{busy === 'save' && <LoaderCircleIcon className="size-4 animate-spin" />}{tz("保存")}</Button></div>
      </div> : <Button size="sm" variant="outline" className="mt-3" onClick={() => { if (requirePro('tools')) setForm({ ...empty }); }}><PlusIcon />{tz("添加企业微信")}</Button>}
    </>}
  </section>;
}
