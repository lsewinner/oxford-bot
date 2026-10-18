import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Composer } from "@/components/chat/composer";
import { useMode } from "@/components/chat/mode-context";
import { createThread, pendingKey } from "@/lib/chat-data";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: NewChat,
});

const SUGGESTIONS = ["用一句话解释量子纠缠", "写一个 Python 快速排序", "帮我想 5 个产品名", "今晚吃什么？给我惊喜"];

function NewChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode } = useMode();
  const [creating, setCreating] = useState(false);

  const start = async (text: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createThread();
      sessionStorage.setItem(pendingKey(id), text);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch {
      toast.error("创建对话失败，请重试");
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src={logo} alt="Nova" width={64} height={64} className="size-16 rounded-2xl" />
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {mode === "fun" ? "来吧，问点刺激的。" : "今天想了解什么？"}
          </h1>
        </div>
        <Composer onSend={start} status={creating ? "submitted" : "ready"} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => start(s)}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
