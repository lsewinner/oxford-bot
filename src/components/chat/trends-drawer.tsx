import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { BrainIcon, ExternalLinkIcon, FlameIcon, RefreshCcwIcon, LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadTrends } from '@/lib/trends.functions';
import { trendAnalysisPrompt } from '@/lib/trends';
import { useMode } from './mode-context';
import { useWebSearch } from './web-search-context';

export function TrendsDrawer({compact=false,open:openProp,onOpenChange}:{compact?:boolean;open?:boolean;onOpenChange?:(v:boolean)=>void}) {
  const [openState,setOpenState]=useState(false);const controlled=openProp!==undefined;const open=controlled?openProp:openState;const setOpen=(v:boolean)=>{if(!controlled)setOpenState(v);onOpenChange?.(v);},[source,setSource]=useState('all');
  const load=useServerFn(loadTrends);
  const {requestAnalysis}=useMode();
  const {setEnabled}=useWebSearch();
  const {data,isFetching,error,refetch}=useQuery({queryKey:['live-trends'],queryFn:()=>load({data:{force:true}}),enabled:open,staleTime:300000,retry:false});
  return <Sheet open={open} onOpenChange={setOpen}>{!controlled&&<SheetTrigger asChild><Button variant="ghost" size="sm" aria-label="实时热点" title="实时热点" className="gap-1.5 text-muted-foreground"><FlameIcon className="size-4"/>{!compact && <span>实时热点</span>}</Button></SheetTrigger>}
    <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
      <div className="border-b border-border p-5 pr-12"><SheetTitle className="flex items-center gap-2"><FlameIcon className="size-5"/>实时热点</SheetTitle><SheetDescription className="mt-1">GitHub Trending · Hacker News 科技头条</SheetDescription></div>
      <div className="flex items-center justify-between gap-2 px-5"><Tabs value={source} onValueChange={setSource}><TabsList><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="github">GitHub</TabsTrigger><TabsTrigger value="hn">科技头条</TabsTrigger></TabsList></Tabs><Button variant="ghost" size="icon-sm" aria-label="刷新热点" title="刷新热点" disabled={isFetching} onClick={()=>void refetch()}><RefreshCcwIcon className={isFetching?'animate-spin':''}/></Button></div>
      {data && <p className="px-5 text-xs text-muted-foreground">更新于 {new Date(data.fetchedAt).toLocaleTimeString('zh-CN')}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {isFetching && !data && <div className="flex items-center gap-2 py-8 text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin"/>正在读取实时资讯…</div>}
        {error && <p role="alert" className="py-4 text-sm text-destructive">热点暂时加载失败，请稍后点刷新重试。</p>}
        {data && data.errors.length>0 && data.items.length>0 && <p className="py-2 text-xs text-muted-foreground">部分来源暂时无法读取，已显示可用资讯。</p>}
        {data?.items.filter(item=>source==='all'||item.source===source).map((item,index)=><article key={item.id} className="border-b border-border py-5">
          <p className="mb-2 font-mono text-[11px] text-muted-foreground">{String(index+1).padStart(2,'0')} · {item.source==='github'?'GitHub Trending':'Hacker News'}</p>
          <a href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-sm font-medium break-words">{item.title}<ExternalLinkIcon className="mt-0.5 size-3 shrink-0"/></a>
          {item.description && <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.description}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{item.metric}</span><Button variant="outline" size="sm" onClick={()=>{setEnabled(true);requestAnalysis(trendAnalysisPrompt(item));setOpen(false);}}><BrainIcon className="size-3.5"/>深度解读</Button></div>
        </article>)}
        {data && !data.items.length && <p className="py-8 text-sm text-muted-foreground">暂无可用资讯，请稍后刷新。</p>}
      </div>
    </SheetContent>
  </Sheet>;
}