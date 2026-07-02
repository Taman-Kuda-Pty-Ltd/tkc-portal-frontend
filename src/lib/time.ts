import dayjs from "dayjs";
import type { TimeFormat } from "../settings/SettingsContext";

// Canonical time strings are always 24h "HH:MM"; display respects the setting.

export function parseHM(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":");
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

export function toHM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Format a canonical "HH:MM" for display. */
export function formatHM(value: string, fmt: TimeFormat): string {
  const { hour, minute } = parseHM(value);
  if (fmt === "24h") return toHM(hour, minute);
  const period = hour < 12 ? "am" : "pm";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")}${period}`;
}

/** Format an ISO datetime's time part for display. */
export function formatISOTime(iso: string, fmt: TimeFormat): string {
  return dayjs(iso).format(fmt === "24h" ? "HH:mm" : "h:mma");
}
