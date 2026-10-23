import { useEffect, useState } from "react";
import { UploadIcon } from "lucide-react";

/** Full-window hint shown while files are dragged over the chat page. */
export function DropOverlay() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types?.includes("Files"));
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setActive(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setActive(false); };
    const done = () => { depth = 0; setActive(false); };
    document.addEventListener("dragenter", enter);
    document.addEventListener("dragleave", leave);
    document.addEventListener("drop", done);
    document.addEventListener("dragend", done);
    return () => {
      document.removeEventListener("dragenter", enter);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("drop", done);
      document.removeEventListener("dragend", done);
    };
  }, []);
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary/50 px-12 py-10 text-center">
        <UploadIcon className="size-8 text-primary" />
        <p className="text-base font-medium">松开即可添加到 Oxford</p>
        <p className="font-mono text-xs text-muted-foreground">图片 · PDF · Word · 文本 · 单个 ≤ 4 MB · 最多 4 个</p>
      </div>
    </div>
  );
}
