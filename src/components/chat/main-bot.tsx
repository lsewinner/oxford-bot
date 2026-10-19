import logo from "@/assets/logo.png";
import { BotListLabel } from "@/components/chat/bot-list-label";
import { cn } from "@/lib/utils";

/** The always-present default Bot (Oxonian), pinned at the top of 「我的 Bots」. */
export function MainBotLabel({ active, preview, time }: { active?: boolean; preview?: string | undefined; time?: string | undefined }) {
  return (
    <BotListLabel name="Oxonian" preview={preview || "开始新对话"} time={time} avatar={
      <span className={cn("relative size-8 shrink-0 rounded-full", active && "ring-1 ring-ring")}>
        <img src={logo} alt="" width={32} height={32} className="size-8 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary" aria-hidden />
      </span>
    } />
  );
}
