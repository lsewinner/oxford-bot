import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";
import { messagesQuery } from "@/lib/chat-data";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(messagesQuery(params.threadId)),
  pendingComponent: () => <div className="p-6 text-sm text-muted-foreground">加载中…</div>,
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(messagesQuery(threadId));
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
  return <ChatWindow key={threadId} threadId={threadId} initialMessages={data.messages} />;
}
