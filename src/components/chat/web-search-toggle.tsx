import { GlobeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSearch } from "./web-search-context";

export function WebSearchToggle() {
  const { enabled, setEnabled } = useWebSearch();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="联网搜索"
      title={enabled ? "联网搜索已开启" : "开启联网搜索"}
      onClick={() => setEnabled(!enabled)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        enabled
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <GlobeIcon className="size-3.5" />
      联网
    </button>
  );
}
