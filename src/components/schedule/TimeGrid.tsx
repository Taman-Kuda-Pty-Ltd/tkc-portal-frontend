import { Paper, Text, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Shift } from "../../api/types";
import { DAY_KEY } from "../../lib/dates";
import { formatHM, formatISOTime } from "../../lib/time";
import { computeHourRange, layoutDay } from "./timeLayout";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

const HOUR_HEIGHT = 46; // px per hour

export function TimeGrid({
  days,
  shiftsByDay,
  ctx,
  onSelectDay,
}: {
  days: Dayjs[];
  shiftsByDay: Map<string, Shift[]>;
  ctx: ScheduleCtx;
  onSelectDay?: (d: Dayjs) => void;
}) {
  const allShifts = days.flatMap((d) => shiftsByDay.get(d.format(DAY_KEY)) ?? []);
  const range = computeHourRange(allShifts);
  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
  const gridHeight = (range.end - range.start) * HOUR_HEIGHT;
  const today = dayjs().format(DAY_KEY);

  const gridlines = `repeating-linear-gradient(var(--mantine-color-default-border) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`;

  return (
    <div style={{ display: "flex", overflowX: "auto" }}>
      {/* hour axis */}
      <div style={{ width: 52, flexShrink: 0 }}>
        <div style={{ height: 24 }} /> {/* aligns with day headers */}
        <div style={{ position: "relative", height: gridHeight }}>
          {hours.map((h) => (
            <Text
              key={h}
              fz={10}
              c="dimmed"
              ta="right"
              pr={6}
              style={{ position: "absolute", top: (h - range.start) * HOUR_HEIGHT - 6, right: 0 }}
            >
              {formatHM(`${String(h).padStart(2, "0")}:00`, ctx.timeFormat)}
            </Text>
          ))}
        </div>
      </div>

      {/* day columns */}
      {days.map((day) => {
        const key = day.format(DAY_KEY);
        const positioned = layoutDay(shiftsByDay.get(key) ?? [], range);
        return (
          <div key={key} style={{ flex: 1, minWidth: 90, borderLeft: "1px solid var(--mantine-color-default-border)" }}>
            {/* header (always 24px to stay aligned with the hour axis) */}
            <div style={{ height: 24 }}>
              {days.length > 1 && (
                <UnstyledButton
                  onClick={() => onSelectDay?.(day)}
                  style={{ display: "block", width: "100%", height: "100%" }}
                >
                  <Text size="xs" fw={600} ta="center" c={key === today ? "teal" : undefined}>
                    {day.format("ddd D")}
                  </Text>
                </UnstyledButton>
              )}
            </div>
            <div style={{ position: "relative", height: gridHeight, background: gridlines }}>
              {positioned.map((p) => {
                const v = shiftVisual(p.shift, ctx);
                return (
                  <UnstyledButton
                    key={p.shift.id}
                    onClick={() => ctx.onEditShift(p.shift)}
                    style={{
                      position: "absolute",
                      top: `${p.topPct}%`,
                      height: `${p.heightPct}%`,
                      left: `calc(${p.leftPct}% + 1px)`,
                      width: `calc(${p.widthPct}% - 2px)`,
                    }}
                  >
                    <Paper
                      h="100%"
                      p={3}
                      radius="sm"
                      bg="var(--mantine-color-default)"
                      style={{
                        borderLeft: `3px solid ${v.color}`,
                        overflow: "hidden",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    >
                      <Text fz={10} fw={600} lineClamp={1}>
                        {v.label}
                      </Text>
                      <Text fz={9} c={v.assigned < v.needed ? "red" : "dimmed"} lineClamp={1}>
                        {formatISOTime(p.shift.starts_at, ctx.timeFormat)} · {v.assigned}/{v.needed}
                      </Text>
                    </Paper>
                  </UnstyledButton>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
