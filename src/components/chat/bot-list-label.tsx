import type { ReactNode } from "react";
import { formatChatTime } from "@/lib/chat-time";

export const botListRowClass = "mb-0.5 flex h-12 w-full min-w-0 items-center rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent";

export function BotListLabel({ avatar, name, preview, time }: { avatar: ReactNode; name: string; preview: string; time?: string | undefined }) {
  return <span className="flex min-w-0 flex-1 items-center gap-2.5">
    <span className="flex size-8 shrink-0 items-center justify-center">{avatar}</span>
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 items-center gap-2 leading-5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        {time ? <span className="shrink-0 text-[10px] text-muted-foreground/70">{formatChatTime(time)}</span> : null}
      </span>
      <span role="status" className="block truncate pr-16 text-[11px] leading-4 text-muted-foreground">{cleanPreview(preview)}</span>
    </span>
  </span>;
}

function cleanPreview(text: string) {
  return text.replace(/<public_summary>[\s\S]*?(<\/public_summary>|$)/g, "").replace(/<\/?[a-z_]+[^>]*>?/gi, "").replace(/\s+/g, " ").trim();
}
