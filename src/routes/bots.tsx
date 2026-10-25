import { tz } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { BotAvatar } from "@/components/chat/bot-presence";
import { Input } from "@/components/ui/input";
import { squareBotsQuery } from "@/lib/bot-share-query";
import { shareToIdentity } from "@/lib/bot-copy";
import { CATEGORY_LABEL, SQUARE_CATEGORIES, filterSquareBots, type SquareCategory } from "@/lib/bot-square";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/bots")({
  loader: ({ context }) => context.queryClient.ensureQueryData(squareBotsQuery()),
  head: () => ({ meta: [
    { title: tz("Bot 广场 · Oxford Bot") },
    { name: "description", content: tz("Oxford Bot 官方精选与审核通过的社区 Bot，打开即可试聊，一键复制到自己的 Bot 列表。") },
    { property: "og:title", content: tz("Bot 广场 · Oxford Bot") },
    { property: "og:description", content: tz("精选 Bot，试聊后一键复制。") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BotSquare,
});

function BotSquare() {
  const { data: bots } = useSuspenseQuery(squareBotsQuery());
  const [cat, setCat] = useState<"all" | SquareCategory>("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => filterSquareBots(bots, cat, q), [bots, cat, q]);
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link to="/" className="flex items-center gap-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></Link>
      <Link to="/chat" className="text-sm text-muted-foreground hover:text-foreground">{tz("返回对话")}</Link>
    </header>
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Oxford Bot · Bot Square</p>
      <h1 className="mt-2 text-3xl font-semibold">{tz("Bot 广场")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tz("官方精选与审核通过的 Bot。点开试聊，满意再复制到自己的 Bot 列表。Pro 会员可在 Bot 设置里申请上架。")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...SQUARE_CATEGORIES] as const).map((c) => <button key={c} type="button" onClick={() => setCat(c)}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", cat === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
            {c === "all" ? tz("全部") : tz(CATEGORY_LABEL[c])}</button>)}
        </div>
        <div className="relative sm:ml-auto sm:w-64"><SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tz("搜索 Bot")} aria-label={tz("搜索 Bot")} className="h-9 pl-8" /></div>
      </div>
      {shown.length === 0
        ? <p className="mt-16 text-center text-sm text-muted-foreground">{bots.length === 0 ? tz("精选 Bot 正在上架中，敬请期待。") : tz("没有找到匹配的 Bot")}</p>
        : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((b) => (
          <Link key={b.token} to="/b/$token" params={{ token: b.token }} className="group flex flex-col gap-3 rounded-xl border border-border p-5 transition-colors hover:border-foreground/40 hover:bg-accent">
            <div className="flex gap-4"><BotAvatar bot={shareToIdentity(b)} />
              <div className="min-w-0"><p className="font-medium">{b.name}</p><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{b.intro || tz("一只来自 Oxford Bot 的专属 Bot。")}</p></div></div>
            <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">{tz(CATEGORY_LABEL[b.category as SquareCategory] ?? "工作提效")}</span>
              <span className="truncate">{b.official ? <span className="font-mono uppercase tracking-widest text-foreground">{tz("Oxford Bot 官方")}</span> : tz("由 @{0} 创建", b.creatorName || tz("社区创作者"))}</span>
            </div>
          </Link>))}</div>}
    </main>
  </div>;
}
