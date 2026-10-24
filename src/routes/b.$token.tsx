import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CopyPlusIcon, MessageCircleIcon, StarIcon, StarOffIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/chat-window";
import { ModeProvider } from "@/components/chat/mode-context";
import { WebSearchProvider } from "@/components/chat/web-search-context";
import { BotAvatar } from "@/components/chat/bot-presence";
import { supabase } from "@/integrations/supabase/client";
import { sharedBotQuery } from "@/lib/bot-share-query";
import { isShareOwnerOrAdmin, revokeBotShare, setBotFeatured } from "@/lib/bot-shares.functions";
import { queueBotCopy, shareToIdentity, trialFromMessages } from "@/lib/bot-copy";
import { guestMessagesKey, parseGuestMessages } from "@/lib/guest-conversations";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/b/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sharedBotQuery(params.token)),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} · Oxford Bot` : "分享的 Bot · Oxford Bot";
    const description = loaderData?.intro || "在 Oxford Bot 试聊这只 Bot，满意后一键复制到自己的 Bot 列表。";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ] };
  },
  errorComponent: () => <Missing />,
  component: SharedBotPage,
});

function Missing() {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
    <p className="text-lg">这个 Bot 链接已失效或被撤销</p>
    <Button asChild variant="outline"><Link to="/bots">去 Bot 广场看看</Link></Button>
  </div>;
}

function SharedBotPage() {
  const { token } = Route.useParams();
  const { data: shared } = useSuspenseQuery(sharedBotQuery(token));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [trial, setTrial] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session))); }, []);
  const checkRole = useServerFn(isShareOwnerOrAdmin);
  const { data: role } = useQuery({ queryKey: ["bot-share-role", token], queryFn: () => checkRole({ data: { token } }), enabled: signedIn });
  const feature = useServerFn(setBotFeatured);
  const revoke = useServerFn(revokeBotShare);
  if (!shared) return <Missing />;
  const bot = shareToIdentity(shared);

  const copy = () => {
    queueBotCopy(bot, trialFromMessages(parseGuestMessages(localStorage.getItem(guestMessagesKey(`guest:share:${token}`)))));
    void navigate({ to: signedIn ? "/chat" : "/guest" });
  };

  return <div className="flex min-h-dvh flex-col bg-background text-foreground">
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link to="/" className="flex items-center gap-2"><img src={logo} width={28} height={28} alt="Oxford Bot" /><span className="text-sm font-medium">Oxford Bot</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/bots">Bot 广场</Link></Button>
    </header>
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="scale-[2.2] py-4"><BotAvatar bot={bot} /></div>
      <h1 className="text-2xl font-semibold">{shared.name}</h1>
      {shared.featured && <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">官方精选</span>}
      <p className="max-w-xl text-sm text-muted-foreground">{shared.intro || "一只来自 Oxford Bot 的专属 Bot。"}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => setTrial(true)} variant={trial ? "secondary" : "default"}><MessageCircleIcon className="size-4" />直接试聊</Button>
        <Button variant="outline" onClick={copy}><CopyPlusIcon className="size-4" />复制到我的 Bots</Button>
      </div>
      <p className="text-xs text-muted-foreground">点「直接试聊」即可在本页聊天；点「复制到我的 Bots」会加入你自己的 Bot 列表。分享者看不到你的对话，你也看不到分享者的任何记录。</p>
      {(role?.admin || role?.owner) && <div className="flex flex-wrap justify-center gap-2 pt-2">
        {role.admin && <Button size="sm" variant="ghost" onClick={async () => {
          try { await feature({ data: { token, featured: !shared.featured } }); await queryClient.invalidateQueries({ queryKey: ["shared-bot", token] }); await queryClient.invalidateQueries({ queryKey: ["featured-bots"] }); toast.success(shared.featured ? "已从官方精选移除" : "已加入官方精选"); }
          catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
        }}>{shared.featured ? <StarOffIcon className="size-4" /> : <StarIcon className="size-4" />}{shared.featured ? "移出官方精选" : "设为官方精选"}</Button>}
        {role.owner && <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
          try { await revoke({ data: { token } }); await queryClient.invalidateQueries({ queryKey: ["shared-bot", token] }); toast.success("分享链接已撤销"); }
          catch (e) { toast.error(e instanceof Error ? e.message : "撤销失败"); }
        }}><Trash2Icon className="size-4" />撤销分享</Button>}
      </div>}
    </section>
    {trial && <div className="mx-auto h-[70dvh] w-full max-w-3xl border-t border-border">
      <ModeProvider><WebSearchProvider><ChatWindow threadId={`guest:share:${token}`} initialMessages={[]} activeBot={bot} botShare={token} /></WebSearchProvider></ModeProvider>
    </div>}
  </div>;
}
