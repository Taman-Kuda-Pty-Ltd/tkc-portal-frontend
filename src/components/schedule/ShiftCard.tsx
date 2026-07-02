import { ActionIcon, Badge, Divider, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { IconPencil, IconPlus, IconUser, IconX } from "@tabler/icons-react";
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
      {(shift.assignments.length > 0 || ctx.canAssign) && <Divider mt={6} mb={4} />}
      <Stack gap={4}>
        {shift.assignments.map((a) => (
          <Badge
            key={a.id}
            variant="light"
            color="gray"
            size="sm"
            radius="sm"
            fullWidth
            leftSection={<IconUser size={11} />}
            rightSection={
              ctx.canAssign ? (
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="gray"
                  onClick={() => ctx.onUnassign(shift.id, a.id)}
                  aria-label="Remove"
                >
                  <IconX size={11} />
                </ActionIcon>
              ) : undefined
            }
            styles={{
              root: { textTransform: "none" },
              label: { fontWeight: 500 },
            }}
          >
            {ctx.personById.get(a.person_id)?.full_name ?? `#${a.person_id}`}
          </Badge>
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
