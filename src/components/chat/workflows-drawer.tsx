import { tz } from "@/lib/i18n";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeftRightIcon, ArrowRightIcon, CalendarDaysIcon, CheckIcon, FileTextIcon, LoaderCircleIcon, PlayIcon, RefreshCcwIcon, WorkflowIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { PROVIDERS } from '@/lib/connections/catalog';
import { accountKey, buildWorkflowPrompt, canReceiveWorkflow, WORKFLOWS, workflowRequestSchema, type WorkflowAccount, type WorkflowId, type WorkflowRequest } from '@/lib/workflows';
import { workflowConnections } from '@/lib/workflows.functions';
import { cn } from '@/lib/utils';

const icons = { report: FileTextIcon, calendar: CalendarDaysIcon, transfer: ArrowLeftRightIcon };

export function WorkflowsDrawer({ busy, onRun }: { busy: boolean; onRun: (text: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(false);
  const [id, setId] = useState<WorkflowId>('weekly');
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState('chat');
  const [details, setDetails] = useState('');
  const [period, setPeriod] = useState<WorkflowRequest['period']>('week');
  const [launching, setLaunching] = useState(false);
  const load = useServerFn(workflowConnections);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setChecking(true);
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setSignedIn(Boolean(data.session)); setChecking(false); } });
    return () => { alive = false; };
  }, [open]);
  const { data: rows = [], isFetching, error, refetch } = useQuery({ queryKey: ['workflow-connections'], queryFn: () => load(), enabled: open && signedIn, staleTime: 0, retry: false, gcTime: 0 });
  const workflow = WORKFLOWS.find(w => w.id === id) ?? WORKFLOWS[0];
  const available = rows.filter(r => r.available);
  const candidates = rows.filter(r => (workflow.providers as readonly string[]).includes(r.provider));
  const sources: WorkflowAccount[] = candidates.filter(r => r.available && selected.includes(accountKey(r))).map(({ provider, account, label }) => ({ provider, account, label }));
  const target = available.find(r => accountKey(r) === destination && canReceiveWorkflow(r.provider));
  const payload = { id, sources, destination: target ? { provider: target.provider, account: target.account, label: target.label } : null, details, period };
  const valid = workflowRequestSchema.safeParse(payload).success;
  const run = async () => {
    if (!valid || launching || busy || isFetching) return;
    setLaunching(true);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
      await onRun(buildWorkflowPrompt(payload, new Date(), zone));
      setOpen(false);
    } catch { toast.error(tz("工作流未能发起，请重试")); }
    finally { setLaunching(false); }
  };

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button type="button" variant="ghost" size="sm" aria-label={tz("工作流")} title={tz("工作流")} disabled={busy} className="gap-1.5 px-2 text-muted-foreground"><WorkflowIcon className="size-4" /><span className="hidden sm:inline">{tz("工作流")}</span></Button></SheetTrigger>
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
      <div className="border-b border-border p-5 pr-12"><SheetTitle className="flex items-center gap-2"><WorkflowIcon className="size-5" />{tz("工作流")}</SheetTitle><SheetDescription className="sr-only">{tz("多工具任务")}</SheetDescription></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="grid grid-cols-3 gap-2 py-5" role="group" aria-label={tz("工作流类型")}>{WORKFLOWS.map(w => { const Icon = icons[w.icon]; return <Button key={w.id} variant={id === w.id ? 'secondary' : 'outline'} aria-pressed={id === w.id} className="h-20 flex-col gap-2 rounded-lg px-1 text-xs" onClick={() => { setId(w.id); setSelected([]); setDestination('chat'); setDetails(''); }}><Icon className="size-5" />{w.name}</Button>; })}</div>
        <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">{workflow.steps.map((step, i) => <li key={step} className="flex items-center gap-2"><span className="font-mono">0{i + 1}</span>{step}{i < 2 && <ArrowRightIcon className="size-3" />}</li>)}</ol>
        {checking ? <p className="py-5 text-sm text-muted-foreground">{tz("正在读取账户…")}</p> : !signedIn ? <Button asChild><Link to="/auth">{tz("登录后使用工作流")}</Link></Button> : <>
          <div className="flex items-center justify-between border-t border-border pt-4"><h2 className="text-sm font-medium">{tz("来源账户")} <span className="ml-2 font-mono text-xs text-muted-foreground">{sources.length}/4</span></h2><Button variant="ghost" size="icon-sm" aria-label={tz("刷新工作流账户")} title={tz("刷新账户")} disabled={isFetching} onClick={() => void refetch()}><RefreshCcwIcon className={cn('size-4', isFetching && 'animate-spin')} /></Button></div>
          {error && <p role="alert" className="py-3 text-sm text-destructive">{tz("账户加载失败，请刷新重试。")}</p>}
          {isFetching && !rows.length && <p className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin" />{tz("正在读取工具账户…")}</p>}
          {!isFetching && !error && !candidates.length && <p className="py-5 text-sm text-muted-foreground">{tz("暂无适用的工具账户")}</p>}
          <div className="mb-5">{candidates.map(row => { const key = accountKey(row); const checked = sources.some(s => accountKey(s) === key); return <label key={key} className={cn('flex min-w-0 items-center gap-3 border-b border-border py-3', !row.available && 'opacity-50')}><Checkbox checked={checked} disabled={!row.available || (!checked && sources.length >= 4) || isFetching} onCheckedChange={v => setSelected(prev => v ? [...prev, key] : prev.filter(k => k !== key))} aria-label={tz("来源 {0} {1}", PROVIDERS[row.provider].name, row.label)} /><span className="min-w-0 flex-1"><span className="block text-sm">{PROVIDERS[row.provider].name}</span><span className="block truncate text-xs text-muted-foreground">{row.label}</span></span>{!row.available && <span className="shrink-0 text-xs text-muted-foreground">{row.reconnectRequired ? tz("需重连") : tz("已停用")}</span>}{checked && <CheckIcon className="size-4 shrink-0" />}</label>; })}</div>
          {id === 'weekly' && <div className="mb-5 space-y-2"><label className="text-sm" htmlFor="workflow-period">{tz("报告范围")}</label><Select value={period} onValueChange={v => { if (v === 'week' || v === 'fortnight' || v === 'month') setPeriod(v); }}><SelectTrigger id="workflow-period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">{tz("最近 7 天")}</SelectItem><SelectItem value="fortnight">{tz("最近 14 天")}</SelectItem><SelectItem value="month">{tz("最近 30 天")}</SelectItem></SelectContent></Select></div>}
          <div className="mb-5 space-y-2"><label className="text-sm" htmlFor="workflow-destination">{id === 'transfer' ? tz("目标账户") : tz("结果去向")}</label><Select value={destination} onValueChange={setDestination}><SelectTrigger id="workflow-destination"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="chat">{tz("仅在对话中生成")}</SelectItem>{available.filter(r => canReceiveWorkflow(r.provider)).map(r => <SelectItem key={accountKey(r)} value={accountKey(r)}>{PROVIDERS[r.provider].name} · {r.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><label className="text-sm" htmlFor="workflow-details">{id === 'meeting' ? tz("会议名称 / 时间") : id === 'transfer' ? tz("整理目标 / 保存位置") : tz("项目 / 补充要求（可选）")}</label>{id === 'meeting' ? <Input id="workflow-details" value={details} maxLength={2000} onChange={e => setDetails(e.target.value)} placeholder={tz("例如：明天下午的产品评审")} /> : <Textarea id="workflow-details" value={details} maxLength={2000} onChange={e => setDetails(e.target.value)} className="min-h-24 resize-none" placeholder={id === 'transfer' ? tz("例如：把 Jira 项目待办整理后发送到我的 Telegram 私聊") : tz("例如：只整理 Oxford 项目的进展与风险")} />}</div>
        </>}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border p-5"><span className="text-xs text-muted-foreground">{id === 'transfer' && !target ? tz("请选择目标账户") : sources.length === 0 ? tz("请选择来源账户") : target ? tz("保存 / 发送前需确认") : tz("仅在当前对话生成")}</span><Button disabled={!signedIn || !valid || isFetching || checking || launching || busy} onClick={() => void run()}>{launching ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}{tz("开始执行")}</Button></div>
    </SheetContent>
  </Sheet>;
}