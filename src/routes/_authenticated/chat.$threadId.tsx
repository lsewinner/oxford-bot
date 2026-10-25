import { tz } from "@/lib/i18n";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";
import { messagesQuery } from "@/lib/chat-data";
import { useBotPresence } from "@/components/chat/bot-presence";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [
    { title: tz("会话记录 · Oxford Bot") },
    { name: "description", content: tz("继续与 Oxford Bot 对话，查看回复与联网搜索来源。") },
    { property: "og:title", content: tz("会话记录 · Oxford Bot") },
    { property: "og:description", content: tz("继续与 Oxford Bot 对话，查看回复与联网搜索来源。") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(messagesQuery(params.threadId)),
  pendingComponent: () => <div className="p-6 text-sm text-muted-foreground">{tz("加载中…")}</div>,
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(messagesQuery(threadId));
  const { entries } = useBotPresence();
  const bot = entries.find((entry) => entry.conversationId === threadId || (entry.threadId === threadId && entry.messageId.startsWith("manual-")))?.bot;
  if (!data.exists) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        这个对话不存在或已被删除。
        <Link to="/chat" className="text-foreground underline">
          新建对话
        </Link>
      </div>
    );
  }
  return <ChatWindow key={threadId} threadId={threadId} initialMessages={data.messages} activeBot={bot ?? null} />;
}
