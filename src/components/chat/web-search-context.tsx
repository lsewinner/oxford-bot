import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const Ctx = createContext<{ enabled: boolean; setEnabled: (v: boolean) => void }>({
  enabled: false,
  setEnabled: () => {},
});

export function WebSearchProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("oxford:websearch") === "1") setEnabledState(true);
  }, []);
  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    localStorage.setItem("oxford:websearch", v ? "1" : "0");
  };
  return <Ctx.Provider value={{ enabled, setEnabled }}>{children}</Ctx.Provider>;
}

export const useWebSearch = () => useContext(Ctx);
