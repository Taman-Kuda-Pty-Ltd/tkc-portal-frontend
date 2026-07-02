import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type TimeFormat = "12h" | "24h";

const KEY = "tkc_time_format";
const WD_START = "tkc_workday_start";
const WD_END = "tkc_workday_end";

interface SettingsState {
  timeFormat: TimeFormat;
  setTimeFormat: (f: TimeFormat) => void;
  /** Work-day window (hours 0-24) — used to highlight the time-grid. */
  workDayStart: number;
  workDayEnd: number;
  setWorkDay: (start: number, end: number) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

function readInt(key: string, fallback: number): number {
  const v = parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(
    () => (localStorage.getItem(KEY) as TimeFormat) || "12h",
  );
  const [workDayStart, setStart] = useState(() => readInt(WD_START, 8));
  const [workDayEnd, setEnd] = useState(() => readInt(WD_END, 20));

  const setTimeFormat = useCallback((f: TimeFormat) => {
    localStorage.setItem(KEY, f);
    setTimeFormatState(f);
  }, []);

  const setWorkDay = useCallback((start: number, end: number) => {
    const s = Math.max(0, Math.min(23, start));
    const e = Math.max(s + 1, Math.min(24, end));
    localStorage.setItem(WD_START, String(s));
    localStorage.setItem(WD_END, String(e));
    setStart(s);
    setEnd(e);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ timeFormat, setTimeFormat, workDayStart, workDayEnd, setWorkDay }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
