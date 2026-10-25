import { Link } from "@tanstack/react-router";
import { BrainCircuitIcon, CandlestickChartIcon, ListChecksIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** First-run cards: market charts, meeting → tickets, Smart Brain. */
export function Showcase({ onPick, signedIn }: { onPick: (prompt: string) => void; signedIn: boolean }) {
  const { t } = useLang();
  const card = "group flex h-full flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4 text-left transition-colors hover:border-foreground/30 hover:bg-card";
  return (
    <section aria-label={t.showcaseKicker} className="w-full">
      <p className="mb-3 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.showcaseKicker}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" className={card} onClick={() => onPick(t.marketPrompt)}>
          <CandlestickChartIcon className="size-5 text-foreground" />
          <span className="text-sm font-medium">{t.marketTitle}</span>
          <span className="text-xs leading-5 text-muted-foreground">{t.marketDesc}</span>
        </button>
        <button type="button" className={card} onClick={() => onPick(t.meetingPrompt)}>
          <ListChecksIcon className="size-5 text-foreground" />
          <span className="text-sm font-medium">{t.meetingTitle}</span>
          <span className="text-xs leading-5 text-muted-foreground">{t.meetingDesc}</span>
        </button>
        <Link to={signedIn ? "/brain" : "/auth"} className={card}>
          <BrainCircuitIcon className="size-5 text-foreground" />
          <span className="text-sm font-medium">{t.brainTitle}</span>
          <span className="text-xs leading-5 text-muted-foreground">{t.brainDesc}</span>
          <span className="mt-auto text-xs text-foreground/80 group-hover:underline">{signedIn ? t.brainCta : t.brainGuest} →</span>
        </Link>
      </div>
    </section>
  );
}
