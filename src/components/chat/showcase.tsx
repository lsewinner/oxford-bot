import { Link } from "@tanstack/react-router";
import { BrainCircuitIcon, CandlestickChartIcon, ListChecksIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** First-run cards: market charts, meeting → tickets, Smart Brain. */
export function Showcase({ onPick, signedIn }: { onPick: (prompt: string) => void; signedIn: boolean }) {
  const { t } = useLang();
  const card = "group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-border bg-card/60 px-2 py-3 text-center transition-colors hover:border-foreground/30 hover:bg-card";
  const icon = "grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground";
  const title = "w-full truncate text-xs font-medium sm:text-sm";
  const desc = "hidden text-xs leading-5 text-muted-foreground sm:line-clamp-2";
  return (
    <section aria-label={t.showcaseKicker} className="w-full">
      <p className="mb-3 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.showcaseKicker}</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={card} onClick={() => onPick(t.marketPrompt)} title={t.marketDesc}>
          <span className={icon}><CandlestickChartIcon className="size-4" /></span>
          <span className={title}>{t.marketTitle}</span>
          <span className={desc}>{t.marketDesc}</span>
        </button>
        <button type="button" className={card} onClick={() => onPick(t.meetingPrompt)} title={t.meetingDesc}>
          <span className={icon}><ListChecksIcon className="size-4" /></span>
          <span className={title}>{t.meetingTitle}</span>
          <span className={desc}>{t.meetingDesc}</span>
        </button>
        <Link to={signedIn ? "/brain" : "/auth"} className={card} title={t.brainDesc}>
          <span className={icon}><BrainCircuitIcon className="size-4" /></span>
          <span className={title}>{t.brainTitle}</span>
          <span className={desc}>{t.brainDesc}</span>
        </Link>
      </div>
    </section>
  );
}
