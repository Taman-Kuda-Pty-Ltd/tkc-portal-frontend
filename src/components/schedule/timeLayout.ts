import dayjs from "dayjs";
import type { Shift } from "../../api/types";

export interface HourRange {
  start: number; // inclusive hour, 0-23
  end: number; // exclusive-ish hour, 1-24
}

export interface PositionedShift {
  shift: Shift;
  topPct: number; // 0..100 within the grid height
  heightPct: number;
  leftPct: number; // horizontal position within the day column (for overlaps)
  widthPct: number;
}

function hoursOf(shift: Shift): { startH: number; endH: number } {
  const s = dayjs(shift.starts_at);
  const e = dayjs(shift.ends_at);
  const startH = s.hour() + s.minute() / 60;
  const durH = Math.max(e.diff(s, "minute"), 15) / 60;
  return { startH, endH: startH + durH };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Hour window that comfortably contains all the given shifts. */
export function computeHourRange(shifts: Shift[]): HourRange {
  if (shifts.length === 0) return { start: 7, end: 18 };
  let min = 24;
  let max = 0;
  for (const s of shifts) {
    const { startH, endH } = hoursOf(s);
    min = Math.min(min, Math.floor(startH));
    max = Math.max(max, Math.ceil(endH));
  }
  min = clamp(min, 0, 23);
  max = clamp(max, 1, 24);
  if (max <= min) max = min + 1;
  return { start: min, end: max };
}

/**
 * Position a day's shifts within the range, splitting the column between
 * overlapping shifts (classic calendar lane-packing).
 */
export function layoutDay(shifts: Shift[], range: HourRange): PositionedShift[] {
  const span = range.end - range.start || 1;
  const items = shifts
    .map((shift) => ({ shift, ...hoursOf(shift) }))
    .sort((a, b) => a.startH - b.startH || a.endH - b.endH);

  // Break into clusters of transitively-overlapping shifts.
  const clusters: (typeof items)[] = [];
  let current: typeof items = [];
  let clusterEnd = -Infinity;
  for (const it of items) {
    if (current.length && it.startH >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(it);
    clusterEnd = Math.max(clusterEnd, it.endH);
  }
  if (current.length) clusters.push(current);

  const out: PositionedShift[] = [];
  for (const cluster of clusters) {
    const colEnds: number[] = []; // last endH per column
    const colOf = new Map<Shift, number>();
    for (const it of cluster) {
      let col = colEnds.findIndex((end) => end <= it.startH);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.endH);
      } else {
        colEnds[col] = it.endH;
      }
      colOf.set(it.shift, col);
    }
    const cols = colEnds.length;
    for (const it of cluster) {
      const top = ((it.startH - range.start) / span) * 100;
      const height = ((Math.min(it.endH, range.end) - it.startH) / span) * 100;
      const col = colOf.get(it.shift) ?? 0;
      out.push({
        shift: it.shift,
        topPct: clamp(top, 0, 100),
        heightPct: clamp(height, 1, 100),
        leftPct: (col / cols) * 100,
        widthPct: (1 / cols) * 100,
      });
    }
  }
  return out;
}
