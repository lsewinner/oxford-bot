import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

/** The always-present default Bot (Oxonian), pinned at the top of 「我的 Bots」. */
export function MainBotLabel({ active, preview }: { active?: boolean; preview?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={cn("relative shrink-0 rounded-full", active && "ring-1 ring-ring")}>
        <img src={logo} alt="" width={28} height={28} className="size-7 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">Oxonian</span>
        <span className="block truncate text-[11px] text-muted-foreground">{preview || "开始新对话"}</span>
      </span>
    </span>
  );
}
