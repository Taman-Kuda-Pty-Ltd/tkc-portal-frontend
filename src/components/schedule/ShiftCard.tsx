import { ActionIcon, Badge, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { IconPencil, IconX } from "@tabler/icons-react";
import { formatISOTime } from "../../lib/time";
import type { Shift } from "../../api/types";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

/** The full shift card used in Week and Day views. */
export function ShiftCard({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  const activity = ctx.activityById.get(shift.activity_id);

  return (
    <Paper
      radius="sm"
      p={6}
      bg="var(--mantine-color-default)"
      style={{ borderLeft: `4px solid ${v.color}` }}
    >
      <Group gap={6} mb={4} wrap="nowrap" justify="space-between" align="flex-start">
        <Text size="sm" fw={600} lineClamp={2}>
          {v.label}
        </Text>
        <Group gap={2} wrap="nowrap">
          <Badge size="sm" variant="light" color={v.fillColor} aria-label="Staffing">
            {v.assigned}/{v.needed}
          </Badge>
          {ctx.canManageShifts && (
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={() => ctx.onEditShift(shift)}
              aria-label="Edit shift"
            >
              <IconPencil size={12} />
            </ActionIcon>
          )}
        </Group>
      </Group>
      <Text size="xs" c="dimmed">
        {formatISOTime(shift.starts_at, ctx.timeFormat)}–
        {formatISOTime(shift.ends_at, ctx.timeFormat)}
        {shift.description ? ` · ${activity?.name ?? ""}` : ""}
      </Text>
      <Stack gap={2} mt={6}>
        {shift.assignments.map((a) => (
          <Group key={a.id} justify="space-between" gap={4} wrap="nowrap">
            <Text size="xs">
              {ctx.personById.get(a.person_id)?.full_name ?? `#${a.person_id}`}
            </Text>
            {ctx.canAssign && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => ctx.onUnassign(shift.id, a.id)}
                aria-label="Remove"
              >
                <IconX size={12} />
              </ActionIcon>
            )}
          </Group>
        ))}
        {ctx.canAssign && (
          <Select
            size="xs"
            placeholder="Assign…"
            searchable
            data={ctx.peopleOptions}
            value={null}
            onChange={(val) => val && ctx.onAssign(shift.id, Number(val))}
            comboboxProps={{ withinPortal: true }}
          />
        )}
      </Stack>
    </Paper>
  );
}
