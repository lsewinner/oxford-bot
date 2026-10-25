import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Composer } from "@/components/chat/composer";
import { useMode } from "@/components/chat/mode-context";
import { createThread, pendingKey } from "@/lib/chat-data";
import { useLang, tz } from "@/lib/i18n";
import { Showcase } from "@/components/chat/showcase";
import type { ChatInput } from "@/lib/chat-attachments";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [
    { title: tz("新对话 · Oxford Bot") },
    { name: "description", content: tz("开始与 Oxford Bot 的新对话，选择 Fun 或 Normal 模式。") },
    { property: "og:title", content: tz("新对话 · Oxford Bot") },
    { property: "og:description", content: tz("开始与 Oxford Bot 的新对话，选择 Fun 或 Normal 模式。") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NewChat,
});

function NewChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode } = useMode();
  const { t } = useLang();
  const [creating, setCreating] = useState(false);

  const start = async (text: string, files: ChatInput["files"] = []) => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createThread();
      sessionStorage.setItem(pendingKey(id), JSON.stringify({ text, files }));
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch {
      toast.error(tz("创建对话失败，请重试"));
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src={logo} alt="Oxford Bot" width={64} height={64} className="size-16 rounded-2xl" />
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {mode === "fun" ? t.newChatTitleFun : t.newChatTitle}
          </h1>
        </div>
        <Composer onSend={start} status={creating ? "submitted" : "ready"} />
        <div className="mt-8"><Showcase signedIn onPick={(p) => start(p)} /></div>
      </div>
    </div>
  );
}
