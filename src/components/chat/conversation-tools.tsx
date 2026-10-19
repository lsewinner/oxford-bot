import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import type { UIMessage } from 'ai';
import { CopyIcon, DownloadIcon, FileTextIcon, LinkIcon, LoaderCircleIcon, Share2Icon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createShare, listShares, revokeShare } from '@/lib/shares.functions';
import { downloadConversation, exportConversation } from '@/lib/conversation-export';
import { isGuestConversation } from '@/lib/guest-conversations';

export function ConversationTools({ messages, threadId, busy }: { messages: UIMessage[]; threadId: string; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [shares, setShares] = useState<{ token: string; created_at: string }[]>([]);
  const create = useServerFn(createShare); const list = useServerFn(listShares); const revoke = useServerFn(revokeShare);
  const guest = isGuestConversation(threadId);
  useEffect(() => {
    if (!open || guest) return;
    setWorking(true);
    void list({ data: { threadId } }).then(setShares).catch(e => toast.error(e.message)).finally(() => setWorking(false));
  }, [open, guest, threadId, list]);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success('已复制'); } catch { toast.error('复制失败，请允许剪贴板访问'); }
  }
  return <>
    <div className="flex items-center justify-end gap-1 border-b border-border px-3 py-1.5">
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" disabled={!messages.length} aria-label="导出对话" title="导出对话"><DownloadIcon className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => downloadConversation(messages, 'markdown')}><FileTextIcon />导出 Markdown</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadConversation(messages, 'text')}><FileTextIcon />导出文本</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy(exportConversation(messages, 'text'))}><CopyIcon />复制对话</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
      <Button size="icon-sm" variant="ghost" disabled={!messages.length || busy} aria-label="分享对话" title="分享对话" onClick={() => setOpen(true)}><Share2Icon className="size-4" /></Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogTitle>公开分享对话</DialogTitle><DialogDescription>持有链接的人可以查看分享时的消息、生成图片和来源。后续消息不会同步；附件、思考过程及服务操作详情不会公开。</DialogDescription>
      {guest ? <Button asChild variant="outline"><Link to="/auth">登录后分享云端对话</Link></Button> : <>
        <Button disabled={working || busy} onClick={async () => {
          setWorking(true); try { const result = await create({ data: { threadId } }); setShares(await list({ data: { threadId } })); await copy(`${window.location.origin}/share/${result.token}`); } catch (e) { toast.error(e instanceof Error ? e.message : '分享失败'); } finally { setWorking(false); }
        }}>{working ? <LoaderCircleIcon className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}创建分享链接</Button>
        <div className="max-h-64 space-y-2 overflow-auto">{shares.map(share => <div key={share.token} className="flex min-w-0 items-center gap-2 border-b border-border py-2">
          <a href={`/share/${share.token}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm">{`/share/${share.token}`}</a>
          <Button variant="ghost" size="icon-sm" aria-label="复制分享链接" onClick={() => void copy(`${window.location.origin}/share/${share.token}`)}><CopyIcon className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="撤销分享链接" title="撤销分享" disabled={working} onClick={async () => { setWorking(true); try { await revoke({ data: { token: share.token } }); setShares(items => items.filter(item => item.token !== share.token)); toast.success('分享链接已撤销'); } catch (e) { toast.error(e instanceof Error ? e.message : '撤销失败'); } finally { setWorking(false); } }}><Trash2Icon className="size-4" /></Button>
        </div>)}</div>
      </>}
    </DialogContent></Dialog>
  </>;
}