import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { shareQuery } from '@/lib/share-query';
import { MessageResponse } from '@/components/ai-elements/message';
import { MediaCard } from '@/components/chat/media-card';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export const Route = createFileRoute('/share/$token')({
  loader: ({ context, params }) => z.string().uuid().safeParse(params.token).success ? context.queryClient.ensureQueryData(shareQuery(params.token)) : null,
  head: () => ({ meta: [
    { title: '公开对话分享 · Oxford Bot' }, { name: 'description', content: '查看 Oxford Bot 对话的公开分享。' },
    { property: 'og:title', content: '公开对话分享 · Oxford Bot' }, { property: 'og:description', content: '查看 Oxford Bot 对话的公开分享。' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: SharePage,
  errorComponent: () => <ShareUnavailable />,
});
function ShareUnavailable() { return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-foreground"><h1 className="text-xl font-semibold">分享链接不存在或已撤销</h1><Button asChild variant="outline"><Link to="/">Oxford Bot</Link></Button></main>; }
function SharePage() {
  const loaded = Route.useLoaderData();
  return loaded ? <SharedConversation /> : <ShareUnavailable />;
}
function SharedConversation() {
  const { token } = Route.useParams();
  const { data: share } = useSuspenseQuery(shareQuery(token));
  if (!share) return <ShareUnavailable />;
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><Link to="/" className="flex items-center gap-2 text-sm font-semibold"><img src={logo} alt="Oxford Bot" className="size-7" />Oxford Bot</Link><span className="text-xs text-muted-foreground">对话快照 · 只读</span></header>
    <main className="mx-auto max-w-3xl px-5 py-8"><h1 className="break-words text-2xl font-semibold">{share.title}</h1><p className="mt-2 text-xs text-muted-foreground">{share.createdAt.slice(0, 10)} · 分享者主动公开的一段对话副本，不包含其账户、其他对话或资料。</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">想自己和 Bot 聊？去 Bot 广场试聊官方精选 Bot，一键复制到你的列表。</p><Button asChild size="sm"><Link to="/bots">去 Bot 广场</Link></Button></div>
      <div className="mt-8 space-y-8">{share.messages.map((message, index) => <article key={`${message.id}-${index}`} className="min-w-0 border-b border-border pb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{message.role === 'user' ? '用户' : 'Oxford Bot'}</h2>
        {message.role === 'user' ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : <MessageResponse>{message.text}</MessageResponse>}
        {message.images.map((image, i) => <MediaCard key={i} url={image.url} filename={`Oxford-generated-${i + 1}.png`} />)}
        {message.sources.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{message.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>}
      </article>)}</div>
    </main>
  </div>;
}