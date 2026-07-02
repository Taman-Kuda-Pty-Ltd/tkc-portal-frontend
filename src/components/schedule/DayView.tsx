import { Button, Group, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import type { Dayjs } from "dayjs";
import type { Shift } from "../../api/types";
import { ShiftCard } from "./ShiftCard";
import type { ScheduleCtx } from "./types";

export function DayView({
  day,
  shifts,
  ctx,
}: {
  day: Dayjs;
  shifts: Shift[];
  ctx: ScheduleCtx;
}) {
  return (
    <Stack gap="sm" maw={640}>
      <Group justify="space-between">
        <Text fw={600}>{day.format("dddd D MMMM YYYY")}</Text>
        {ctx.canManageShifts && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => ctx.onAddShift(day)}
          >
            Add shift
          </Button>
        )}
      </Group>
      {shifts.length === 0 ? (
        <Text c="dimmed" size="sm">
          No shifts scheduled.
        </Text>
      ) : (
        <Stack gap={8}>
          {shifts.map((s) => (
            <ShiftCard key={s.id} shift={s} ctx={ctx} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
