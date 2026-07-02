import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Shift } from "../api/types";

/** Monday (00:00) of the week containing `d`. */
export function mondayOf(d: Dayjs): Dayjs {
  const dow = (d.day() + 6) % 7; // 0 = Monday
  return d.subtract(dow, "day").startOf("day");
}

export const DAY_KEY = "YYYY-MM-DD";

/** Group shifts by their local calendar day (YYYY-MM-DD). */
export function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = dayjs(s.starts_at).format(DAY_KEY);
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return map;
}
