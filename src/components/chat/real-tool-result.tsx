import { useEffect,useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { CheckIcon,LoaderCircleIcon,PlugIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { actionStatus,confirmOperation } from '@/lib/connections.functions';
import type { ToolResult } from '@/lib/connections/catalog';
export function RealToolResult({output,onComplete}:{output:ToolResult;onComplete?:(result:ToolResult)=>void}){
 const [result,setResult]=useState(output),[busy,setBusy]=useState(false);const confirm=useServerFn(confirmOperation),read=useServerFn(actionStatus);
 useEffect(()=>{setResult(output);if(output.actionId && output.status==='confirmation_required')void read({data:{actionId:output.actionId}}).then(v=>{if(v.result)setResult(v.result);else if(v.status==='executing')setResult({...output,status:'error',summary:'操作正在处理，请稍后刷新查看；不要重复提交'});}).catch(()=>{});},[output,read]);
 const act=async(approve:boolean)=>{if(!output.actionId || busy)return;setBusy(true);try{const r=await confirm({data:{actionId:output.actionId,approve}});setResult(r);onComplete?.(r);}catch(e){toast.error(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}};
 // Batch approval is a user click that confirms each listed card through its own server-side claim.
 const actRef=useRef(act);actRef.current=act;const pendingRef=useRef(result.status==='confirmation_required');pendingRef.current=result.status==='confirmation_required';
 useEffect(()=>{const on=(e:Event)=>{const ids=(e as CustomEvent<string[]>).detail;if(output.actionId && pendingRef.current && Array.isArray(ids) && ids.includes(output.actionId))void actRef.current(true);};window.addEventListener('oxford:confirm-all',on);return()=>window.removeEventListener('oxford:confirm-all',on);},[output.actionId]);
 return <div className="my-3 rounded-lg border border-border bg-card p-3 text-sm leading-6">
 <p className="flex items-center gap-2 font-medium">{busy?<LoaderCircleIcon className="size-4 animate-spin"/>:result.status==='completed'?<CheckIcon className="size-4"/>:<PlugIcon className="size-4"/>}{result.provider} · {busy?'正在执行':{completed:'已完成',confirmation_required:'等待确认',reconnect_required:'需要重新授权',error:'执行失败',cancelled:'已取消'}[result.status]}</p>
 <p className={result.status==='error'?'mt-2 break-words text-destructive':'mt-2 break-words text-muted-foreground'}>{result.summary}</p>
 {result.text && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">{result.text}</pre>}
 {result.items?.map((item,i)=><div key={i} className="mt-2 border-t border-border pt-2"><p className="break-words">{item.url?.startsWith('https://')?<a href={item.url} target="_blank" rel="noreferrer" className="underline">{item.title}</a>:item.title}</p>{item.id && <p className="break-all font-mono text-xs text-muted-foreground">{item.id}</p>}{item.detail && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.detail}</p>}</div>)}
 {result.status==='confirmation_required' && <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={()=>act(true)}>确认执行</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>act(false)}>取消</Button></div>}
 </div>;
}
