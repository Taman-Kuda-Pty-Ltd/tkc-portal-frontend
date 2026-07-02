import { Box, Stack, Text, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Shift } from "../../api/types";
import { DAY_KEY, mondayOf } from "../../lib/dates";
import { ShiftChip } from "./ShiftChip";
import type { ScheduleCtx } from "./types";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;
const GRID_COLUMNS = "32px repeat(7, minmax(0, 1fr))";

export function MonthView({
  anchor,
  shiftsByDay,
  ctx,
  onSelectDay,
  onSelectWeek,
}: {
  anchor: Dayjs;
  shiftsByDay: Map<string, Shift[]>;
  ctx: ScheduleCtx;
  onSelectDay: (d: Dayjs) => void;
  onSelectWeek: (weekStart: Dayjs) => void;
}) {
  const gridStart = mondayOf(anchor.startOf("month"));
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => gridStart.add(w * 7 + d, "day")),
  );
  const today = dayjs().format(DAY_KEY);
  const month = anchor.month();

  return (
    <div>
      {/* header row: gutter + weekday names */}
      <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 4, marginBottom: 4 }}>
        <div />
        {WEEKDAY_NAMES.map((n) => (
          <Text key={n} size="xs" fw={600} c="dimmed" ta="center">
            {n}
          </Text>
        ))}
      </div>

      <Stack gap={4}>
        {weeks.map((week) => (
          <div
            key={week[0].format(DAY_KEY)}
            style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 4 }}
          >
            {/* week gutter -> drill to week */}
            <UnstyledButton
              onClick={() => onSelectWeek(week[0])}
              title="Open week"
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text fz={10} c="dimmed">
                {week[0].format("D")}
              </Text>
            </UnstyledButton>

            {week.map((day) => {
              const key = day.format(DAY_KEY);
              const shifts = shiftsByDay.get(key) ?? [];
              const inMonth = day.month() === month;
              const isToday = key === today;
              return (
                <Box
                  key={key}
                  p={4}
                  style={{
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: 6,
                    minHeight: 96,
                    opacity: inMonth ? 1 : 0.45,
                    background: isToday ? "var(--mantine-color-teal-light)" : undefined,
                  }}
                >
                  <UnstyledButton
                    onClick={() => onSelectDay(day)}
                    style={{ display: "block", marginBottom: 2 }}
                    title="Open day"
                  >
                    <Text size="xs" fw={isToday ? 700 : 500} ta="right">
                      {day.date()}
                    </Text>
                  </UnstyledButton>
                  <Stack gap={2}>
                    {shifts.slice(0, MAX_CHIPS).map((s) => (
                      <ShiftChip key={s.id} shift={s} ctx={ctx} />
                    ))}
                    {shifts.length > MAX_CHIPS && (
                      <UnstyledButton onClick={() => onSelectDay(day)}>
                        <Text fz={10} c="dimmed">
                          +{shifts.length - MAX_CHIPS} more
                        </Text>
                      </UnstyledButton>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </div>
        ))}
      </Stack>
    </div>
  );
}
