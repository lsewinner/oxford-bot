import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ChatMode } from "@/lib/ai/modes";

const Ctx = createContext<{ mode: ChatMode; setMode: (m: ChatMode) => void; deepThink:boolean; setDeepThink:(v:boolean)=>void; analysis:string|null; requestAnalysis:(text:string)=>void; clearAnalysis:()=>void }>({
  mode: "normal",
  setMode: () => {},
  deepThink:false, setDeepThink:()=>{}, analysis:null, requestAnalysis:()=>{}, clearAnalysis:()=>{},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ChatMode>("normal");
  const [deepThink,setDeepThinkState]=useState(false);
  const [analysis,setAnalysis]=useState<string|null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("oxford:mode");
    if (saved === "fun" || saved === "normal") setModeState(saved);
    setDeepThinkState(localStorage.getItem('oxford:deep-think')==='true');
  }, []);
  const setMode = (m: ChatMode) => {
    setModeState(m);
    localStorage.setItem("oxford:mode", m);
  };
  const setDeepThink=(v:boolean)=>{setDeepThinkState(v);localStorage.setItem('oxford:deep-think',String(v));};
  return <Ctx.Provider value={{ mode, setMode, deepThink, setDeepThink, analysis, requestAnalysis:(text)=>{setDeepThink(true);setAnalysis(text);}, clearAnalysis:()=>setAnalysis(null) }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
