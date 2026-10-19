import logo from "@/assets/logo.png";
import { formatChatTime } from "@/lib/chat-time";
import { cn } from "@/lib/utils";

/** The always-present default Bot (Oxonian), pinned at the top of 「我的 Bots」. */
export function MainBotLabel({ active, preview, time }: { active?: boolean; preview?: string; time?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className={cn("relative shrink-0 rounded-full", active && "ring-1 ring-ring")}>
        <img src={logo} alt="" width={28} height={28} className="size-7 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">Oxonian</span>
        <span className="block truncate text-[11px] text-muted-foreground">{preview || "开始新对话"}</span>
      </span>
      {time ? <span className="shrink-0 self-start text-[10px] text-muted-foreground/70">{formatChatTime(time)}</span> : null}
    </span>
  );
}
