import { useEffect, useState } from "react";
import { allowedToolIds, type ToolId } from "@/lib/tool-catalog";

const KEY = "oxford:simulated-tools";
const EVENT = "oxford:tools-changed";
export function useTools() {
  const [enabled, setEnabled] = useState<ToolId[]>([]);
  useEffect(() => {
    const update = () => {
      try { setEnabled(allowedToolIds(JSON.parse(localStorage.getItem(KEY) ?? "[]"))); }
      catch { setEnabled([]); }
    };
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  const toggle = (id: ToolId, checked: boolean) => {
    const next = checked ? allowedToolIds([...enabled, id]) : enabled.filter((item) => item !== id);
    setEnabled(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* session-only preference */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return { enabled, toggle };
}