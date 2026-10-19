import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CheckIcon, CopyIcon, FileTextIcon, GlobeIcon, RefreshCcwIcon, SearchIcon } from "lucide-react";
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
import { useWebSearch } from "./web-search-context";

function errorText(err: Error) {
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not json */
  }
  return err.message || "出错了，请重试";
}

export function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const { mode } = useMode();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { enabled: webSearch } = useWebSearch();
  const webSearchRef = useRef(webSearch);
  webSearchRef.current = webSearch;
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
        body: () => ({ threadId, mode: modeRef.current, webSearch: webSearchRef.current }),
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
    if (sentPending.current) return;
    sentPending.current = true;
    const key = pendingKey(threadId);
    const pending = sessionStorage.getItem(key);
    if (pending && initialMessages.length === 0) {
      sessionStorage.removeItem(key);
      // Defer to the next macrotask. Sending synchronously from this effect is
      // dropped by the chat store before it dispatches, losing the first question.
      setTimeout(() => sendMessage({ text: pending }), 0);
      const refresh = setTimeout(() => queryClient.invalidateQueries({ queryKey: ["threads"] }), 1500);
      return () => clearTimeout(refresh);
    }
    return undefined;
  }, [threadId, initialMessages.length, sendMessage, queryClient]);

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

type SearchAction =
  | { type: "search"; query?: string; queries?: string[] }
  | { type: "openPage"; url?: string | null }
  | { type: "findInPage"; url?: string | null; pattern?: string };

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SearchSteps({ part, streaming }: { part: UIMessage["parts"][number]; streaming: boolean }) {
  const p = part as { state?: string; output?: { action?: SearchAction } };
  const action = p.output?.action;
  const done = p.state === "output-available" || !!p.output;
  const steps: { icon: typeof SearchIcon; label: string; active: boolean }[] = [];
  if (!action || action.type === "search") {
    const q = action?.type === "search" ? (action.queries ?? (action.query ? [action.query] : [])) : [];
    steps.push({
      icon: SearchIcon,
      label: q.length ? `正在检索：${q.join("、")}` : "正在检索关键词",
      active: !done,
    });
  }
  if (action?.type === "openPage" && action.url) {
    steps.push({ icon: GlobeIcon, label: `正在阅读：${domainOf(action.url)}`, active: !done });
  }
  if (action?.type === "findInPage" && action.url) {
    steps.push({ icon: FileTextIcon, label: `正在定位内容：${domainOf(action.url)}`, active: !done });
  }
  if (done) steps.push({ icon: FileTextIcon, label: "正在整理答案", active: streaming });
  if (steps.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <s.icon className="size-3.5 shrink-0" />
          {s.active ? <Shimmer>{s.label}</Shimmer> : <span>{s.label.replace("正在", "已")}</span>}
        </div>
      ))}
    </div>
  );
}

function SourceCards({ sources }: { sources: { url: string; title?: string }[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">来源</div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-foreground">{s.title || domainOf(s.url)}</span>
              <span className="block truncate text-muted-foreground">{domainOf(s.url)}</span>
            </span>
          </a>
        ))}
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
