import { ActionIcon, Badge, Divider, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { IconPencil, IconPlus, IconX } from "@tabler/icons-react";
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
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderLeft: `4px solid ${v.color}`,
      }}
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
      <Divider mt={6} mb={4} />
      <Text size="xs" fw={700} tt="uppercase" mb={3} style={{ letterSpacing: 0.6 }}>
        Staff
      </Text>
      <Stack gap={4}>
        {shift.assignments.length === 0 && (
          <Text size="xs" c="dimmed">
            None
          </Text>
        )}
        {shift.assignments.map((a) => (
          <Group
            key={a.id}
            justify="space-between"
            gap={6}
            wrap="nowrap"
            pl={8}
            pr={2}
            py={2}
            style={{
              background: "var(--mantine-color-gray-light)",
              borderRadius: "var(--mantine-radius-sm)",
            }}
          >
            <Text size="sm" fw={600} lineClamp={1}>
              {ctx.personById.get(a.person_id)?.full_name ?? `#${a.person_id}`}
            </Text>
            {ctx.canAssign && (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => ctx.onUnassign(shift.id, a.id)}
                aria-label="Remove"
              >
                <IconX size={14} />
              </ActionIcon>
            )}
          </Group>
        ))}
        {ctx.canAssign && (
          <Select
            size="xs"
            variant="filled"
            placeholder="Assign…"
            leftSection={<IconPlus size={12} />}
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
