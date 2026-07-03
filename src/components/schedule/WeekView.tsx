import { SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Shift } from "../../api/types";
import { DAY_KEY } from "../../lib/dates";
import { ShiftCard } from "./ShiftCard";
import type { ScheduleCtx } from "./types";

export function WeekView({
  weekStart,
  shiftsByDay,
  ctx,
  onSelectDay,
}: {
  weekStart: Dayjs;
  shiftsByDay: Map<string, Shift[]>;
  ctx: ScheduleCtx;
  onSelectDay: (d: Dayjs) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
  const today = dayjs().format(DAY_KEY);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4, xl: 7 }} spacing="xs">
      {days.map((day) => {
        const key = day.format(DAY_KEY);
        const shifts = shiftsByDay.get(key) ?? [];
        return (
          <div key={key}>
            <UnstyledButton onClick={() => onSelectDay(day)} style={{ display: "block", width: "100%" }}>
              <Text
                fw={600}
                size="sm"
                pb={4}
                mb={6}
                c={key === today ? "teal" : undefined}
                style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
              >
                {day.format("ddd D MMM")}
              </Text>
            </UnstyledButton>
            <Stack gap={6}>
              {shifts.map((s) => (
                <ShiftCard key={s.id} shift={s} ctx={ctx} />
              ))}
            </Stack>
          </div>
        );
      })}
    </SimpleGrid>
  );
}
