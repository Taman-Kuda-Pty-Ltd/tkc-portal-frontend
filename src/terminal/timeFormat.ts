// Terminal time formatting honouring the club's admin-set 12h/24h preference.
import dayjs from "dayjs";

export type TimeFormat = "12h" | "24h";

/** Format an ISO datetime string as a clock time in the club's chosen format. */
export function fmtTime(iso: string, format: TimeFormat): string {
  return dayjs(iso).format(format === "12h" ? "h:mm A" : "HH:mm");
}

/** The current wall-clock time in the business timezone, formatted per the
 *  club's preference. Uses Intl so it is correct regardless of the device's tz. */
export function nowInBusinessTz(tz: string, format: TimeFormat, date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: format === "12h",
    }).format(date);
  } catch {
    return dayjs(date).format(format === "12h" ? "h:mm A" : "HH:mm");
  }
}

/** The current date (weekday + day + month) in the business timezone. */
export function dateInBusinessTz(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
  } catch {
    return dayjs(date).format("dddd D MMMM");
  }
}
