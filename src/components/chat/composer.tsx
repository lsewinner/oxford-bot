import type { ChatStatus } from "ai";
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

export function Composer({
  onSend,
  status = "ready",
  onStop,
  placeholder = "有什么想问的？",
}: {
  onSend: (text: string) => void;
  status?: ChatStatus;
  onStop?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);

  const handleSubmit = (msg: PromptInputMessage) => {
    const t = (msg.text ?? text).trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
    ref.current?.focus();
  };

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="rounded-3xl border-border bg-card shadow-[0_0_0_1px_var(--border),0_20px_60px_-20px_oklch(0_0_0/0.8)]"
    >
      <PromptInputTextarea
        ref={ref}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-h-14 px-5 pt-4 text-[15px]"
      />
      <PromptInputFooter className="px-3 pb-3">
        <PromptInputTools>
          <ModeToggle />
          <WebSearchToggle />
          <ToolsCenter />
        </PromptInputTools>
        <PromptInputSubmit
          status={status}
          {...(onStop ? { onStop } : {})}
          disabled={!busy && !text.trim()}
          className="rounded-full"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
