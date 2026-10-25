import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useLang, tz } from "@/lib/i18n";
import { Showcase } from "./showcase";
import { acquireChat, chatIsRunning, mountChat, type ChatContext } from "@/lib/chat-pool";
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
import { PublicSummary } from './public-summary';
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { pendingKey } from "@/lib/chat-data";
import { Composer } from "./composer";
import { useMode } from "./mode-context";
import { useWebSearch } from "./web-search-context";
import { BotAvatar, useBotPresence } from "./bot-presence";
import { botsFromMessages, type BotIdentity } from "@/lib/bot-presence";
import { guestMessagesKey, isGuestConversation } from "@/lib/guest-conversations";
import { parsePendingInput } from "@/lib/chat-attachments";
import { FileAttachment, GeneratedImage } from "./media-card";
import { SpeakControls } from "./voice-controls";
import { RealToolResult } from './real-tool-result';
import type { ToolResult } from '@/lib/connections/catalog';
import { ConversationTools } from './conversation-tools';
import { DataChart, MarketQuotes, type ChartOutput, type MarketOutput } from './data-cards';

function errorText(err: Error) {
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not json */
  }
  return err.message || tz("出错了，请重试");
}

export function ChatWindow({ threadId, initialMessages, activeBot = null, botShare }: { threadId: string; initialMessages: UIMessage[]; activeBot?: BotIdentity | null; botShare?: string }) {
  const { mode, deepThink } = useMode();
  const { lang, t: tr } = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const deepThinkRef=useRef(deepThink);
  deepThinkRef.current=deepThink;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { enabled: webSearch } = useWebSearch();
  const webSearchRef = useRef(webSearch);
  webSearchRef.current = webSearch;
  const queryClient = useQueryClient();
  const botRef = useRef(activeBot);
  botRef.current = activeBot;

  const botShareRef = useRef(botShare);
  botShareRef.current = botShare;
  const { report, settle, entries, register } = useBotPresence();
  const mountedRef = useRef(true);
  const presenceBotRef = useRef<BotIdentity | null>(activeBot);
  const ctx: ChatContext = {
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    body: () => ({ threadId: isGuestConversation(threadId) ? "guest" : threadId, mode: modeRef.current, lang: langRef.current, deepThink:deepThinkRef.current, webSearch: webSearchRef.current, bot: botRef.current ? { name: botRef.current.name, kind: botRef.current.kind, systemPrompt:botRef.current.systemPrompt, preferredTools:botRef.current.preferredTools } : null, ...(botShareRef.current ? { botShare: botShareRef.current } : {}) }),
    onError: (e) => toast.error(errorText(e)),
    onFinish: (finished) => {
      // Keep the cached thread current so reopening it (even after it finished in the background) shows the replies.
      if (!isGuestConversation(threadId)) queryClient.setQueryData(["messages", threadId], { exists: true, messages: finished });
      else { try { localStorage.setItem(guestMessagesKey(threadId), JSON.stringify(finished)); } catch { /* storage full */ } }
      queryClient.invalidateQueries({ queryKey: ["threads"] }); queryClient.invalidateQueries({ queryKey: ["bot-history"] }); queryClient.invalidateQueries({ queryKey: ["thread-previews"] });
      if (!mountedRef.current) settle(threadId);
    },
    onStatus: (s) => { if (!mountedRef.current) report(threadId, { bot: presenceBotRef.current, status: s }); },
  };
  const entry = acquireChat(threadId, initialMessages, ctx);
  useEffect(() => {
    mountedRef.current = true;
    const release = mountChat(threadId);
    return () => { mountedRef.current = false; release(); };
  }, [threadId]);

  const { messages, setMessages, sendMessage, status, stop, regenerate } = useChat({ chat: entry.chat });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
      setTimeout(() => sendMessage(parsePendingInput(pending)), 0);
      const refresh = setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["threads"] }); queryClient.invalidateQueries({ queryKey: ["thread-previews"] }); }, 1500);
      return () => clearTimeout(refresh);
    }
    return undefined;
  }, [threadId, initialMessages.length, sendMessage, queryClient]);

  const busy = status === "submitted" || status === "streaming";
  const requests = useMemo(() => botsFromMessages(threadId, messages), [threadId, messages]);
  useEffect(() => register(requests), [register, requests]);
  useEffect(() => {
    if (!isGuestConversation(threadId)) return;
    try { localStorage.setItem(guestMessagesKey(threadId), JSON.stringify(messages)); }
    catch { toast.error(tz("本机存储空间不足，请下载图片；当前对话可能无法完整保存")); }
  }, [threadId, messages]);
  const lastRequest = requests.at(-1);
  const bot = activeBot ?? entries.find((entry) => entry.id === lastRequest?.id)?.bot ?? lastRequest?.bot ?? null;
  presenceBotRef.current = bot;
  useEffect(() => {
    report(threadId, { bot, status });
  }, [threadId, bot, status, report]);
  // Leaving a thread keeps its Bot "working" in the sidebar while the reply continues in the background.
  useEffect(() => () => { if (!chatIsRunning(threadId)) settle(threadId); }, [threadId, settle]);
  const lastMessage = messages.at(-1);
  const lastAssistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((p) => (p.type === "text" || p.type === "reasoning") && p.text);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {activeBot && <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3"><BotAvatar bot={activeBot} /><h1 className="min-w-0 truncate text-base font-medium">{activeBot.name}</h1></header>}
      <ConversationTools messages={messages} threadId={threadId} busy={busy} />
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pb-10 pt-6">
          {activeBot && messages.length === 0 && <p className="text-sm text-muted-foreground">{tr.askBot}</p>}
          {!activeBot && messages.length === 0 && isGuestConversation(threadId) && <div className="flex min-h-[45vh] items-end"><Showcase signedIn={false} onPick={(p) => sendMessage({ text: p })} /></div>}
          {messages.map((m, idx) => (
            <div key={m.id} id={`message-${m.id}`}>
            <ChatMessage
              message={m}
              bot={(() => {
                const preceding = botsFromMessages(threadId, messages.slice(0, idx + 1)).at(-1);
                return activeBot ?? entries.find((entry) => entry.id === preceding?.id)?.bot ?? preceding?.bot ?? null;
              })()}
              streaming={busy && idx === messages.length - 1}
              canRegenerate={!busy && idx === messages.length - 1 && m.role === "assistant"}
              onRegenerate={() => regenerate()}
              fresh={!initialMessages.some((message) => message.id === m.id)}
              onImageComplete={(toolCallId, image, prompt) => {
                const updated = messagesRef.current.map((message) => message.id !== m.id ? message : { ...message, parts: message.parts.map((part) => part.type === "tool-generate_image" && part.toolCallId === toolCallId && part.state === "output-available" ? { ...part, output: { ...(part.output as object), image, prompt } } : part) });
                setMessages(updated);
                if (!isGuestConversation(threadId)) {
                  const saved = updated.find((message) => message.id === m.id);
                  if (saved) void supabase.from("messages").update({ parts: saved.parts as never }).eq("thread_id", threadId).eq("ui_id", m.id).then(({ error }) => { if (error) toast.error(tz("图片保存失败，请先下载图片")); });
                }
              }}
            />
            </div>
          ))}
          {busy && !lastAssistantHasText && (
            <div className="flex items-center gap-3 px-1 text-sm">
              {bot && lastMessage?.role !== "assistant" && <BotAvatar bot={bot} working />}
              <Shimmer>{mode === "fun" ? tr.thinkingFun : tr.thinking}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        <Composer
          status={status}
          onStop={stop}
          onSend={(text, files) => {
            sendMessage(files?.length ? { text, files } : { text });
          }}
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
      label: q.length ? tz("正在检索：{0}", q.join("、")) : tz("正在检索关键词"),
      active: !done,
    });
  }
  if (action?.type === "openPage" && action.url) {
    steps.push({ icon: GlobeIcon, label: tz("正在阅读：{0}", domainOf(action.url)), active: !done });
  }
  if (action?.type === "findInPage" && action.url) {
    steps.push({ icon: FileTextIcon, label: tz("正在定位内容：{0}", domainOf(action.url)), active: !done });
  }
  if (done) steps.push({ icon: FileTextIcon, label: tz("正在整理答案"), active: streaming });
  if (steps.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <s.icon className="size-3.5 shrink-0" />
          {s.active ? <Shimmer>{s.label}</Shimmer> : <span>{s.label.replace(tz("正在"), tz("已"))}</span>}
        </div>
      ))}
    </div>
  );
}

type Source = { url: string; title?: string | undefined };

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources
    .filter((s) => {
      const d = domainOf(s.url);
      if (seen.has(d)) return false;
      seen.add(d);
      return true;
    })
    .slice(0, 8);
}

function SourceCards({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{tz("来源")}</div>
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
  bot,
  streaming,
  canRegenerate,
  onRegenerate,
  onImageComplete,
  fresh,
}: {
  message: UIMessage;
  bot: BotIdentity | null;
  streaming: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onImageComplete: (toolCallId: string, image: string, prompt: string) => void;
  fresh: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
  // 合并两类来源：正文中模型引用的链接（按出现顺序）+ 检索工具返回的来源
  const cited: Source[] = [];
  for (const m of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = m[1];
    if (url && !cited.some((s) => domainOf(s.url) === domainOf(url))) cited.push({ url });
  }
  const toolSources: Source[] = message.parts
    .filter((p) => p.type === "source-url")
    .map((p) => {
      const s = p as { url: string; title?: string };
      return { url: s.url, title: s.title };
    });
  const sources = dedupeSources([
    ...cited,
    ...toolSources.filter((s) => !cited.some((c) => domainOf(c.url) === domainOf(s.url))),
  ]);

  return (
    <Message from={message.role}>
      {message.role === "assistant" && (
        bot ? <div className="flex items-center gap-2"><BotAvatar bot={bot} working={streaming} /><span className="text-xs font-medium text-muted-foreground">{bot.name}</span></div> : <img
          src={logo}
          alt="Oxford Bot"
          width={28}
          height={28}
          className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border"
        />
      )}
      <MessageContent
        className={
          message.role === "user"
            ? "rounded-3xl bg-secondary px-4 py-2.5 text-secondary-foreground group-[.is-user]:bg-secondary group-[.is-user]:text-secondary-foreground"
            : "w-full bg-transparent px-0 text-[15px] leading-7 text-foreground"
        }
      >
        {message.parts.map((part, i) => {
          if (part.type === "file") return <FileAttachment key={i} url={part.url} mediaType={part.mediaType} {...(part.filename ? { filename: part.filename } : {})} />;
          if (part.type === "tool-generate_image") {
            const generation = part as { state?: string; toolCallId: string; input?: { prompt?: string }; output?: { prompt?: string; image?: string }; errorText?: string };
            if (generation.state === "output-error") return <p key={i} role="alert" className="text-sm text-destructive">{generation.errorText ?? tz("图片任务失败")}</p>;
            const prompt = generation.output?.prompt ?? generation.input?.prompt;
            if (!prompt) return <Shimmer key={i}>{tz("正在构思画面…")}</Shimmer>;
            return <GeneratedImage key={generation.toolCallId} prompt={prompt} {...(generation.output?.image ? { image: generation.output.image } : {})} autoStart={fresh && !streaming && generation.state === "output-available"} onComplete={(image, prompt) => onImageComplete(generation.toolCallId, image, prompt)} />;
          }
          if (part.type === "reasoning" && part.text) {
            return (
              <Reasoning key={i} className="rounded-lg border border-border bg-card p-3" isStreaming={streaming && i === message.parts.length - 1} defaultOpen={false}>
                <ReasoningTrigger getThinkingMessage={(active)=>active?tz("正在深入思考 · 推理摘要"):tz("思考摘要 · 展开查看论证与核查")}/>
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          }
          if (part.type === "tool-web_search") {
            return <SearchSteps key={i} part={part} streaming={streaming} />;
          }
          if (part.type.startsWith("tool-demo_")) {
            const step = part as { type: string; state?: string; output?: { provider?: string; summary?: string; sample?: string }; errorText?: string };
            const done = step.state === "output-available";
            return <details key={i} className="mb-3 border-l-2 border-border pl-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer py-1">{tz("模拟 ·")} {step.output?.provider ?? step.type.replace("tool-demo_", "")} · {done ? tz("已完成") : step.state === "output-error" ? tz("执行失败") : tz("正在执行")}</summary>
              <p className="mt-2">{step.errorText ?? step.output?.summary ?? tz("正在准备模拟结果…")}</p>
              {step.output?.sample && <p className="mt-2">{step.output.sample}</p>}
            </details>;
          }
          if (part.type === "tool-market_quotes" || part.type === "tool-render_chart") {
            const step = part as { state?: string; output?: unknown; errorText?: string };
            if (step.state === "output-error") return <p key={i} role="alert" className="text-sm text-destructive">{step.errorText ?? tz("执行失败")}</p>;
            if (!step.output) return <Shimmer key={i}>{part.type === "tool-market_quotes" ? tz("正在获取实时行情…") : tz("正在绘制图表…")}</Shimmer>;
            return part.type === "tool-market_quotes" ? <MarketQuotes key={i} output={step.output as MarketOutput} /> : <DataChart key={i} spec={step.output as ChartOutput} />;
          }
          if (part.type.startsWith('tool-service_')) {
            const step = part as { state?: string; output?: ToolResult; errorText?: string };
            if (step.state === 'output-error') return <p key={i} role="alert" className="text-sm text-destructive">{step.errorText ?? tz("执行失败")}</p>;
            if (step.output) {
              const pending = message.parts.flatMap((p) => {
                const o = (p as { output?: ToolResult }).output;
                return p.type.startsWith('tool-service_') && o?.status === 'confirmation_required' && o.actionId ? [o.actionId] : [];
              });
              const first = pending.length > 1 && pending[0] === step.output.actionId;
              return <div key={i}>
                {first && <Button size="sm" variant="secondary" className="mb-2" onClick={() => window.dispatchEvent(new CustomEvent('oxford:confirm-all', { detail: pending }))}>{tz("一键确认全部")} {pending.length} {tz("项")}</Button>}
                <RealToolResult output={step.output} />
              </div>;
            }
            return <Shimmer key={i}>{tz("正在调用 {0}…", part.type.replace('tool-service_', ''))}</Shimmer>;
          }
          if (part.type === "text") {
            if(message.role==='assistant' && part.text.includes('<public_summary>'))return <PublicSummary key={i} text={part.text} streaming={streaming}/>;
            return message.role === "user" ? (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : (
              <MessageResponse
                key={i}
                isAnimating={streaming}
                components={{
                  a: ({ href, children }) => {
                    const idx = href ? sources.findIndex((s) => domainOf(s.url) === domainOf(href)) : -1;
                    if (idx >= 0) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-secondary px-1 align-super text-[10px] font-semibold text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {idx + 1}
                        </a>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {part.text}
              </MessageResponse>
            );
          }
          return null;
        })}
        {message.role === "assistant" && <SourceCards sources={sources} />}
      </MessageContent>
      {message.role === "assistant" && text && !streaming && (
        <MessageActions className="-mt-2">
          <MessageAction
            tooltip={tz("复制")}
            label={tz("复制")}
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </MessageAction>
          <SpeakControls text={text} />
          {canRegenerate && (
            <MessageAction tooltip={tz("重新生成")} label={tz("重新生成")} onClick={onRegenerate}>
              <RefreshCcwIcon className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  );
}
