import { Paper, Text, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import type { Shift } from "../../api/types";
import { DAY_KEY } from "../../lib/dates";
import { formatHM, formatISOTime } from "../../lib/time";
import { useSettings } from "../../settings/SettingsContext";
import { layoutDay } from "./timeLayout";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

const HOUR_HEIGHT = 56; // px per hour
const RANGE = { start: 0, end: 24 }; // midnight to midnight
const SPAN = RANGE.end - RANGE.start;
const GRID_HEIGHT = SPAN * HOUR_HEIGHT;
const AXIS_WIDTH = 52;
const HEADER_HEIGHT = 24;
const MIN_COL_WIDTH = 120; // a single-lane day column
const MIN_LANE_WIDTH = 88; // minimum width per concurrent shift
const OFF_HOURS_SHADE = "color-mix(in srgb, var(--mantine-color-gray-6) 12%, transparent)";
const BLOCK_BG = "color-mix(in srgb, var(--mantine-color-default) 86%, transparent)";
const SURFACE = "var(--mantine-color-body)";

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
  const { workDayStart, workDayEnd } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Start scrolled to the work day rather than midnight.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, workDayStart * HOUR_HEIGHT - HOUR_HEIGHT / 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detailed = days.length === 1; // day view has room for more per block
  const hours = Array.from({ length: SPAN }, (_, i) => RANGE.start + i);
  const todayKey = now.format(DAY_KEY);
  const nowTop = (now.hour() + now.minute() / 60) * HOUR_HEIGHT;
  const gridlines = `repeating-linear-gradient(var(--mantine-color-default-border) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`;

  // Per-day layout + a width that keeps each overlap lane readable.
  const dayData = days.map((day) => {
    const key = day.format(DAY_KEY);
    const blocks = layoutDay(shiftsByDay.get(key) ?? [], RANGE);
    const maxLanes = blocks.reduce((m, b) => Math.max(m, Math.round(100 / b.widthPct)), 1);
    const width = Math.max(MIN_COL_WIDTH, maxLanes * MIN_LANE_WIDTH);
    return { day, key, blocks, width };
  });

  return (
    <div ref={scrollRef} style={{ maxHeight: "70vh", overflow: "auto", position: "relative" }}>
      {/* header row — sticky to the top while scrolling vertically */}
      <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 3, background: SURFACE }}>
        <div
          style={{
            flex: `0 0 ${AXIS_WIDTH}px`,
            height: HEADER_HEIGHT,
            position: "sticky",
            left: 0,
            zIndex: 4,
            background: SURFACE,
          }}
        />
        {dayData.map(({ day, key, width }) => (
          <div key={key} style={{ flex: `1 0 ${width}px`, minWidth: width }}>
            {days.length > 1 && (
              <UnstyledButton
                onClick={() => onSelectDay?.(day)}
                style={{ display: "block", width: "100%", height: HEADER_HEIGHT }}
              >
                <Text size="xs" fw={600} ta="center" c={key === todayKey ? "teal" : undefined}>
                  {day.format("ddd D")}
                </Text>
              </UnstyledButton>
            )}
          </div>
        ))}
      </div>

      {/* body */}
      <div style={{ display: "flex" }}>
        {/* hour axis — sticky to the left while scrolling horizontally */}
        <div
          style={{
            flex: `0 0 ${AXIS_WIDTH}px`,
            position: "sticky",
            left: 0,
            zIndex: 2,
            background: SURFACE,
            height: GRID_HEIGHT,
          }}
        >
          <div style={{ position: "relative", height: GRID_HEIGHT }}>
            {hours.map((h) => (
              <Text
                key={h}
                fz={10}
                c="dimmed"
                ta="right"
                pr={6}
                style={{ position: "absolute", top: Math.max(0, h * HOUR_HEIGHT - 6), right: 0 }}
              >
                {formatHM(`${String(h).padStart(2, "0")}:00`, ctx.timeFormat)}
              </Text>
            ))}
          </div>
        </div>

        {/* day columns */}
        {dayData.map(({ key, blocks, width }) => {
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              style={{
                flex: `1 0 ${width}px`,
                minWidth: width,
                borderLeft: "1px solid var(--mantine-color-default-border)",
                position: "relative",
                height: GRID_HEIGHT,
                background: gridlines,
              }}
            >
              {/* off-hours shading */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: workDayStart * HOUR_HEIGHT,
                  background: OFF_HOURS_SHADE,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: workDayEnd * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                  height: (24 - workDayEnd) * HOUR_HEIGHT,
                  background: OFF_HOURS_SHADE,
                  pointerEvents: "none",
                }}
              />

              {/* current-time line */}
              {isToday && (
                <div
                  style={{
                    position: "absolute",
                    top: nowTop,
                    left: 0,
                    right: 0,
                    borderTop: "2px solid var(--mantine-color-red-6)",
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -3,
                      top: -4,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--mantine-color-red-6)",
                    }}
                  />
                </div>
              )}

              {/* shift blocks */}
              {blocks.map((p) => {
                const v = shiftVisual(p.shift, ctx);
                const activity = ctx.activityById.get(p.shift.activity_id);
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
                      zIndex: 2,
                    }}
                  >
                    <Paper
                      h="100%"
                      p={3}
                      radius="sm"
                      style={{
                        background: BLOCK_BG,
                        border: "1px solid var(--mantine-color-default-border)",
                        borderLeft: `3px solid ${v.color}`,
                        overflow: "hidden",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    >
                      <Text fz={detailed ? 12 : 10} fw={600} lineClamp={1}>
                        {v.label}
                      </Text>
                      <Text fz={detailed ? 10 : 9} c={v.assigned < v.needed ? "red" : "dimmed"} lineClamp={1}>
                        {formatISOTime(p.shift.starts_at, ctx.timeFormat)}
                        {detailed ? `–${formatISOTime(p.shift.ends_at, ctx.timeFormat)}` : ""} ·{" "}
                        {v.assigned}/{v.needed}
                      </Text>
                      {detailed && p.shift.description && activity && (
                        <Text fz={9} c="dimmed" lineClamp={1}>
                          {activity.name}
                        </Text>
                      )}
                      <Text
                        fz={detailed ? 11 : 10}
                        fw={700}
                        tt="uppercase"
                        mt={4}
                        style={{ letterSpacing: 0.5 }}
                      >
                        Staff
                      </Text>
                      {p.shift.assignments.length === 0 ? (
                        <Text fz={detailed ? 11 : 10} c="dimmed" lineClamp={1}>
                          None
                        </Text>
                      ) : (
                        p.shift.assignments.map((a) => (
                          <Text key={a.id} fz={detailed ? 13 : 12} fw={700} lineClamp={1}>
                            {ctx.personById.get(a.person_id)?.full_name ?? `#${a.person_id}`}
                          </Text>
                        ))
                      )}
                    </Paper>
                  </UnstyledButton>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
