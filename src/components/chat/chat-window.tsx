import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { pendingKey } from "@/lib/chat-data";
import { Composer } from "./composer";
import { useMode } from "./mode-context";

function errorText(err: Error) {
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not json */
  }
  return err.message || "出错了，请重试";
}

let INSTANCE = 0;

export function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const self = useRef(++INSTANCE).current;
  console.warn("[pd] render", self, threadId.slice(0, 4), "msgs:", initialMessages.length);
  const { mode } = useMode();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const queryClient = useQueryClient();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({ threadId, mode: modeRef.current }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(errorText(e)),
    onFinish: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
  });

  const sentPending = useRef(false);
  useEffect(() => {
    console.warn("[pd] effect", self);
    if (sentPending.current) return;
    sentPending.current = true;
    const key = pendingKey(threadId);
    const pending = sessionStorage.getItem(key);
    if (pending && initialMessages.length === 0) {
      sessionStorage.removeItem(key);
      const t = setTimeout(() => {
        console.warn("[pd] send", self);
        sendMessage({ text: pending });
      }, 0);
      const refresh = setTimeout(() => queryClient.invalidateQueries({ queryKey: ["threads"] }), 1500);
      return () => {
        console.warn("[pd] cleanup", self, "timer", !!t);
        clearTimeout(refresh);
      };
    }
  }, [threadId, initialMessages.length, sendMessage, queryClient, self]);

  const busy = status === "submitted" || status === "streaming";
  const lastAssistantHasText =
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)!.parts.some((p) => (p.type === "text" || p.type === "reasoning") && p.text);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pb-10 pt-6">
          {messages.map((m, idx) => (
            <ChatMessage
              key={m.id}
              message={m}
              streaming={busy && idx === messages.length - 1}
              canRegenerate={!busy && idx === messages.length - 1 && m.role === "assistant"}
              onRegenerate={() => regenerate()}
            />
          ))}
          {busy && !lastAssistantHasText && (
            <div className="px-1 text-sm">
              <Shimmer>{mode === "fun" ? "正在憋个大招…" : "思考中…"}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        <Composer
          status={status}
          onStop={stop}
          onSend={(text) => {
            sendMessage({ text });
          }}
          placeholder="继续追问…"
        />
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  streaming,
  canRegenerate,
  onRegenerate,
}: {
  message: UIMessage;
  streaming: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");

  return (
    <Message from={message.role}>
      <MessageContent
        className={
          message.role === "user"
            ? "rounded-3xl bg-secondary px-4 py-2.5 text-secondary-foreground group-[.is-user]:bg-secondary group-[.is-user]:text-secondary-foreground"
            : "w-full bg-transparent px-0 text-[15px] leading-7 text-foreground"
        }
      >
        {message.parts.map((part, i) => {
          if (part.type === "reasoning" && part.text) {
            return (
              <Reasoning key={i} isStreaming={streaming && i === message.parts.length - 1} defaultOpen={false}>
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          }
          if (part.type === "text") {
            return message.role === "user" ? (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : (
              <MessageResponse key={i} isAnimating={streaming}>
                {part.text}
              </MessageResponse>
            );
          }
          return null;
        })}
      </MessageContent>
      {message.role === "assistant" && text && !streaming && (
        <MessageActions className="-mt-2">
          <MessageAction
            tooltip="复制"
            label="复制"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </MessageAction>
          {canRegenerate && (
            <MessageAction tooltip="重新生成" label="重新生成" onClick={onRegenerate}>
              <RefreshCcwIcon className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  );
}
