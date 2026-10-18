import { cn } from "@/lib/utils";
import { useMode } from "./mode-context";

export function ModeToggle() {
  const { mode, setMode } = useMode();
  return (
    <div
      role="radiogroup"
      aria-label="回答模式"
      className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-medium"
    >
      {(["normal", "fun"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            mode === m
              ? m === "fun"
                ? "bg-fun text-fun-foreground"
                : "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "fun" ? "Fun" : "Normal"}
        </button>
      ))}
    </div>
  );
}
