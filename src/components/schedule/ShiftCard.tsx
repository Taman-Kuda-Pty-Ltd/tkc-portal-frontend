import { ActionIcon, Badge, Divider, Group, Paper, Select, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { formatISOTime } from "../../lib/time";
import type { ActivityHeading, Shift } from "../../api/types";
import { effectiveCount, shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";
import { RichTextView } from "../RichText";

/** The full shift card used in Week and Day views. */
export function ShiftCard({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  const activity = ctx.activityById.get(shift.activity_id);
  const headings = (activity?.headings ?? []).filter((h) => h.is_active);

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
        <UnstyledButton
          onClick={() => ctx.onOpenShift(shift)}
          style={{ flex: 1, textAlign: "left" }}
          title="View shift"
        >
          <Text size="sm" fw={600} lineClamp={2}>
            {v.label}
          </Text>
        </UnstyledButton>
        <Group gap={4} wrap="nowrap">
          {shift.status === "draft" && (
            <Badge size="sm" variant="light" color="gray">Draft</Badge>
          )}
          {shift.approval_status === "pending" && (
            <Badge size="sm" variant="light" color="yellow">Pending</Badge>
          )}
          <Badge size="sm" variant="light" color={v.fillColor} aria-label="Staffing">
            {v.assigned}/{v.needed}
          </Badge>
        </Group>
      </Group>
      <Text size="xs" c="dimmed">
        {formatISOTime(shift.starts_at, ctx.timeFormat)}–
        {formatISOTime(shift.ends_at, ctx.timeFormat)}
        {shift.title ? ` · ${activity?.name ?? ""}` : ""}
      </Text>
      {shift.description && (
        <Text size="xs" c="dimmed" mt={4} component="div">
          <RichTextView html={shift.description} />
        </Text>
      )}
      {shift.notes.length > 0 && (
        <Text size="xs" c="dimmed" mt={4}>
          {shift.notes.length} note{shift.notes.length === 1 ? "" : "s"}
        </Text>
      )}
      <Divider mt={6} mb={4} />
      {headings.length > 0 ? (
        <Stack gap={8}>
          {headings.map((h) => (
            <HeadingGroup key={h.id} shift={shift} ctx={ctx} heading={h} />
          ))}
        </Stack>
      ) : (
        <HeadingGroup shift={shift} ctx={ctx} heading={null} />
      )}
    </Paper>
  );
}

/** One heading's assigned people + an eligibility-filtered assign picker.
 *  heading=null renders a generic "Staff" group (activities with no headings). */
function HeadingGroup({
  shift,
  ctx,
  heading,
}: {
  shift: Shift;
  ctx: ScheduleCtx;
  heading: ActivityHeading | null;
}) {
  const assigned = shift.assignments.filter((a) =>
    heading ? a.heading_id === heading.id : a.heading_id === null,
  );
  const label = heading?.label ?? "Staff";
  const target = heading ? effectiveCount(shift, heading) : undefined;
  const isLesson = !!ctx.activityById.get(shift.activity_id)?.is_lesson;
  const eligible = [...ctx.personById.values()]
    .filter((p) => p.is_active)
    .filter(
      (p) =>
        !heading?.qualifying_role_id ||
        p.roles.some((r) => r.id === heading.qualifying_role_id),
    )
    .filter((p) => !assigned.some((a) => a.person_id === p.id))
    .map((p) => ({ value: String(p.id), label: p.full_name }));

  return (
    <div>
      <Group gap={6} mb={3} justify="space-between">
        <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: 0.6 }}>
          {label}
        </Text>
        {target !== undefined && (
          <Badge size="xs" variant="light" color={assigned.length >= target ? "teal" : "yellow"}>
            {assigned.length}/{target}
          </Badge>
        )}
      </Group>
      <Stack gap={4}>
        {assigned.length === 0 && <Text size="xs" c="dimmed">None</Text>}
        {assigned.map((a) => (
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
            <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
              {a.person_name ?? `#${a.person_id}`}
            </Text>
            {ctx.canAssign && isLesson && (
              <Tooltip label="Secondary (shadow) coach — paid a share of the lesson" withArrow>
                <Badge
                  size="xs"
                  variant={a.coach_kind === "secondary" ? "filled" : "light"}
                  color={a.coach_kind === "secondary" ? "grape" : "gray"}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    ctx.onSetCoachKind(shift.id, a.id, a.coach_kind === "secondary" ? "primary" : "secondary")
                  }
                >
                  {a.coach_kind === "secondary" ? "2nd" : "Lead"}
                </Badge>
              </Tooltip>
            )}
            {ctx.canAssign && (
              <ActionIcon size="sm" variant="subtle" color="red"
                onClick={() => ctx.onUnassign(shift.id, a.id)} aria-label="Remove">
                <IconX size={14} />
              </ActionIcon>
            )}
          </Group>
        ))}
        {ctx.canAssign && (
          <Select
            size="xs"
            variant="filled"
            placeholder={`Assign ${label.toLowerCase()}…`}
            leftSection={<IconPlus size={12} />}
            searchable
            data={eligible}
            value={null}
            nothingFoundMessage="No eligible people"
            onChange={(val) => val && ctx.onAssign(shift.id, Number(val), heading?.id ?? null)}
            comboboxProps={{ withinPortal: true }}
          />
        )}
      </Stack>
    </div>
  );
}
