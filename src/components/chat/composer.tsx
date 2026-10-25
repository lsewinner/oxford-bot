import type { ChatStatus } from "ai";
import { DropOverlay } from "./drop-overlay";
import { useEffect, useRef, useState } from "react";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { ModeToggle } from "./mode-toggle";
import { WebSearchToggle } from "./web-search-toggle";
import { ToolsCenter } from "./tools-center";
import { toast } from "sonner";
import { AttachmentButton, AttachmentPreviews, AttachmentSubmit } from "./composer-attachments";
import { VoiceInputButton } from "./voice-controls";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, prepareAttachments, type ChatInput } from "@/lib/chat-attachments";
import { useMode } from './mode-context';
import { BrainIcon, AudioLinesIcon, PlusIcon, XIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { TrendsDrawer } from './trends-drawer';
import { usePro } from '@/components/pro/pro-context';
import { WorkflowsDrawer } from './workflows-drawer';
import { useLang } from '@/lib/i18n';

export function Composer({
  onSend,
  status = "ready",
  onStop,
  placeholder,
}: {
  onSend: (text: string, files?: ChatInput["files"]) => void | Promise<void>;
  status?: ChatStatus;
  onStop?: () => void;
  placeholder?: string;
}) {
  const { t: tr } = useLang();
  const [text, setText] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const {deepThink,setDeepThink,analysis,clearAnalysis}=useMode();
  const { isPro, requirePro } = usePro();
  const deepOn = deepThink && isPro;
  const analysisRef=useRef<string|null>(null);
  useEffect(()=>{
    if(!analysis || busy || analysisRef.current===analysis)return;
    analysisRef.current=analysis;
    const timer=setTimeout(()=>{clearAnalysis();void onSend(analysis);},0);
    return ()=>{clearTimeout(timer);analysisRef.current=null;};
  },[analysis,busy,onSend,clearAnalysis]);

  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);

  const handleSubmit = async (msg: PromptInputMessage) => {
    const t = (msg.text ?? text).trim();
    if ((!t && !msg.files.length) || busy) return;
    const files = await prepareAttachments(msg.files);
    await onSend(t || "请分析这些附件。", files);
    setText("");
    ref.current?.focus();
  };

  return (
    <PromptInput
      onSubmit={handleSubmit}
      accept={ATTACHMENT_ACCEPT}
      multiple
      globalDrop
      maxFiles={MAX_ATTACHMENTS}
      maxFileSize={MAX_ATTACHMENT_BYTES}
      onError={(error) => toast.error(error.code === "max_files" ? "每次最多上传 4 个附件" : error.code === "max_file_size" ? "单个附件不能超过 4 MB" : "请选择图片、PDF、Word 或文本文件")}
      className="rounded-3xl border-border bg-card shadow-[0_0_0_1px_var(--border),0_20px_60px_-20px_oklch(0_0_0/0.8)]"
    >
      <DropOverlay />
      <AttachmentPreviews />
      <div className="relative w-full">
        <PromptInputTextarea
          ref={ref}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? tr.placeholder}
          className="min-h-14 py-4 pl-5 pr-14 text-[15px]"
        />
        <div className="absolute right-2.5 top-2.5">
          <VoiceInputButton
            {...(busy && onStop ? { onBeforeStart: onStop } : {})}
            onTranscript={(spoken, autoSend) => {
              if (autoSend) { void onSend(spoken); return; }
              setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${spoken}` : spoken));
              ref.current?.focus();
            }}
          />
        </div>
      </div>
      <PromptInputFooter className="px-3 pb-3">
        <PromptInputTools className="flex-wrap">
          <Button type="button" variant={moreOpen ? "secondary" : "ghost"} size="icon" className="size-8 rounded-full" aria-label={moreOpen ? tr.less : tr.more} aria-expanded={moreOpen} title="上传文件与更多功能" onClick={() => setMoreOpen((v) => !v)}>
            <PlusIcon className={`size-4 transition-transform ${moreOpen ? "rotate-45" : ""}`} />
          </Button>
          {moreOpen ? (
            <>
              <AttachmentButton disabled={busy} />
              <Button asChild type="button" variant="ghost" size="sm" className="gap-1.5 px-2" title="全屏实时语音对讲"><Link to="/voice" aria-label="全屏实时语音"><AudioLinesIcon className="size-4"/><span className="text-xs">{tr.liveVoice}</span></Link></Button>
              <ModeToggle />
              <WebSearchToggle />
              <Button type="button" variant={deepOn?'secondary':'ghost'} size="sm" aria-label="Deep Think 深度思考" aria-pressed={deepOn} title="深度思考 · 推理摘要与核查" disabled={busy} className="gap-1.5 px-2" onClick={()=>{ if(!requirePro('deep_think'))return; setDeepThink(!deepThink); }}><BrainIcon className="size-4"/><span className="text-xs">Deep Think</span></Button>
              <TrendsDrawer compact />
              <WorkflowsDrawer busy={busy} onRun={onSend} />
              <ToolsCenter />
            </>
          ) : deepOn ? (
            <Button type="button" variant="secondary" size="sm" className="h-7 gap-1 rounded-full px-2.5 text-xs" aria-label="关闭 Deep Think" onClick={() => setDeepThink(false)}>
              <BrainIcon className="size-3.5" />Deep Think<XIcon className="size-3" />
            </Button>
          ) : null}
        </PromptInputTools>
        <div className="flex shrink-0 items-center gap-1">
          <AttachmentSubmit text={text} busy={busy}>{(disabled) => <PromptInputSubmit
            status={status}
            {...(onStop ? { onStop } : {})}
            disabled={disabled}
            className="rounded-full"
          />}</AttachmentSubmit>
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}
