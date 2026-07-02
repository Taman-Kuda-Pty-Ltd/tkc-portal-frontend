import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type TimeFormat = "12h" | "24h";

const KEY = "tkc_time_format";

interface SettingsState {
  timeFormat: TimeFormat;
  setTimeFormat: (f: TimeFormat) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(
    () => (localStorage.getItem(KEY) as TimeFormat) || "12h",
  );

  const setTimeFormat = useCallback((f: TimeFormat) => {
    localStorage.setItem(KEY, f);
    setTimeFormatState(f);
  }, []);

  return (
    <SettingsContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
