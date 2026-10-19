import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ChatMode } from "@/lib/ai/modes";

const Ctx = createContext<{ mode: ChatMode; setMode: (m: ChatMode) => void }>({
  mode: "normal",
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ChatMode>("normal");
  useEffect(() => {
    const saved = localStorage.getItem("oxford:mode");
    if (saved === "fun" || saved === "normal") setModeState(saved);
  }, []);
  const setMode = (m: ChatMode) => {
    setModeState(m);
    localStorage.setItem("oxford:mode", m);
  };
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
