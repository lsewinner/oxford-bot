import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BotAvatar } from "@/components/chat/bot-presence";
import { featuredBotsQuery } from "@/lib/bot-share-query";
import { shareToIdentity } from "@/lib/bot-copy";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/bots")({
  loader: ({ context }) => context.queryClient.ensureQueryData(featuredBotsQuery()),
  head: () => ({ meta: [
    { title: "Bot 广场 · Oxford Bot" },
    { name: "description", content: "Oxford Bot 官方精选的专属 Bot，打开即可试聊，一键复制到自己的 Bot 列表。" },
    { property: "og:title", content: "Bot 广场 · Oxford Bot" },
    { property: "og:description", content: "官方精选 Bot，试聊后一键复制。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BotSquare,
});

function BotSquare() {
  const { data: bots } = useSuspenseQuery(featuredBotsQuery());
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link to="/" className="flex items-center gap-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></Link>
      <Link to="/chat" className="text-sm text-muted-foreground hover:text-foreground">返回对话</Link>
    </header>
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Oxford · Bot Square</p>
      <h1 className="mt-2 text-3xl font-semibold">Bot 广场</h1>
      <p className="mt-2 text-sm text-muted-foreground">官方精选的专属 Bot。点开试聊，满意再复制到自己的 Bot 列表。</p>
      {bots.length === 0
        ? <p className="mt-16 text-center text-sm text-muted-foreground">精选 Bot 正在上架中，敬请期待。</p>
        : <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{bots.map((b) => (
          <Link key={b.token} to="/b/$token" params={{ token: b.token }} className="group flex gap-4 rounded-xl border border-border p-5 transition-colors hover:border-foreground/40 hover:bg-accent">
            <BotAvatar bot={shareToIdentity(b)} />
            <div className="min-w-0"><p className="font-medium">{b.name}</p><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{b.intro || "一只来自 Oxford Bot 的专属 Bot。"}</p></div>
          </Link>))}</div>}
    </main>
  </div>;
}
