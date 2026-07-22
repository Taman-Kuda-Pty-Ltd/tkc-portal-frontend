import { ActionIcon, Badge, Divider, Group, Paper, Select, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconClock, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { formatISOTime } from "../../lib/time";
import type { ActivityHeading, Shift } from "../../api/types";
import { effectiveCount, eligibleAssignees, shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";
import { RichTextView } from "../RichText";

/** The full shift card used in Week and Day views. */
export function ShiftCard({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  const activity = ctx.activityById.get(shift.activity_id);
  const clashes = ctx.clashByShift?.get(shift.id) ?? [];
  const headings = (activity?.headings ?? []).filter((h) => h.is_active);
  const highlighted = ctx.highlightShiftId === shift.id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);
  const highlightStyle = highlighted
    ? { outline: "2px solid var(--mantine-color-teal-5)", outlineOffset: 2 }
    : {};

  // Cancelled shifts are hidden by default; when shown they collapse to a struck line.
  if (shift.status === "cancelled") {
    return (
      <Paper radius="sm" p={6} bg="var(--mantine-color-default)"
        style={{ border: "1px dashed var(--mantine-color-default-border)", opacity: 0.6 }}>
        <UnstyledButton onClick={() => ctx.onOpenShift(shift)} style={{ width: "100%", textAlign: "left" }}>
          <Group gap={6} justify="space-between" wrap="nowrap">
            <Text size="sm" td="line-through" c="dimmed" lineClamp={1}>{v.label}</Text>
            <Badge size="sm" variant="light" color="red">Cancelled</Badge>
          </Group>
        </UnstyledButton>
      </Paper>
    );
  }

  return (
    <Paper
      ref={ref}
      radius="sm"
      p={6}
      bg="var(--mantine-color-default)"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderLeft: `4px solid ${v.color}`,
        ...highlightStyle,
      }}
    >
      {/* SCHED-LIST-CHIPS: title on its own line; status chips wrap onto the line
          below so a busy shift no longer concatenates into one cramped row. */}
      <UnstyledButton
        onClick={() => ctx.onOpenShift(shift)}
        style={{ width: "100%", textAlign: "left" }}
        title="View shift"
      >
        <Text size="sm" fw={600} lineClamp={2}>
          {v.label}
        </Text>
      </UnstyledButton>
      <Group gap={4} wrap="wrap" mt={4}>
          {shift.status === "draft" && (
            <Badge size="sm" variant="light" color="gray">Draft</Badge>
          )}
          {activity?.is_lesson && shift.assignments.length === 0 && (
            <Badge size="sm" variant="light" color="orange" style={{ cursor: "pointer" }}
              title="No coach assigned — open the shift"
              onClick={() => ctx.onOpenShift(shift)}>No coach</Badge>
          )}
          {activity?.is_lesson && (shift.rides?.length ?? 0) === 0 && (
            <Badge size="sm" variant="light" color="orange" style={{ cursor: "pointer" }}
              title="No students assigned — open the shift"
              onClick={() => ctx.onOpenShift(shift)}>No students</Badge>
          )}
          {shift.approval_status === "pending" && (
            <Badge size="sm" variant="light" color="yellow">Pending</Badge>
          )}
          {clashes.length > 0 && (
            <Tooltip
              withArrow
              multiline
              label={clashes
                .map((c) => `${c.resource_name} also on "${c.other_shift_label}" (${formatISOTime(c.other_starts_at, ctx.timeFormat)})`)
                .join("\n")}
            >
              <Badge size="sm" variant="filled" color="red">Double booked</Badge>
            </Tooltip>
          )}
          <Badge size="sm" variant="light" color={v.fillColor} aria-label="Staffing">
            {v.assigned}/{v.needed}
          </Badge>
      </Group>
      <Text size="xs" c="dimmed">
        {formatISOTime(shift.starts_at, ctx.timeFormat)}–
        {formatISOTime(shift.ends_at, ctx.timeFormat)}
        {shift.title ? ` · ${activity?.name ?? ""}` : ""}
      </Text>
      {shift.facility_name && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          📍 {shift.facility_name}
        </Text>
      )}
      {shift.description && (
        <Text size="xs" c="dimmed" mt={4} component="div">
          <RichTextView html={shift.description} />
        </Text>
      )}
      {activity?.is_lesson && (shift.rides?.length ?? 0) > 0 && (
        <Text size="xs" c="dimmed" mt={4} component="div">
          <Text span fw={600} c="grape">Riders</Text>
          {/* One rider (+ horse) per line (UAT#3 RIDERS-PERLINE). */}
          {shift.rides.map((r, i) => (
            <div key={i}>{(r.student_name ?? "Student") + (r.horse_name ? ` on ${r.horse_name}` : "")}</div>
          ))}
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
  // Lead/assisting + share only mean something once a lesson is shared by 2+ coaches.
  const showCoachSplit = isLesson && assigned.length >= 2;
  // SCHED-PAST-SHIFT-STATE: a shift whose scheduled end is already in the past.
  const isPast = new Date(shift.ends_at).getTime() < Date.now();
  // Required role: the heading's qualifying role, else the shift's role (from its activity).
  const requiredRole = heading?.qualifying_role_id ?? shift.role_id ?? null;
  const people = [...ctx.personById.values()];
  const requiredRoleName = requiredRole
    ? people.flatMap((p) => p.roles).find((r) => r.id === requiredRole)?.name ?? null
    : null;
  const eligible = eligibleAssignees(
    people,
    requiredRole,
    assigned.map((a) => a.person_id),
    requiredRoleName,
  );

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
        {assigned.map((a) => {
          // T5-09: the name gets its own line so a narrow week column no longer
          // squeezes it to a few characters; status + controls wrap onto the row
          // below (previously they shared one no-wrap row and overran the name).
          const showStatus =
            (a.attendance_status === "checked_in" && !isPast) ||
            a.attendance_status === "checked_out" ||
            (isPast && a.attendance_status !== "checked_out");
          const hasControlsRow = showStatus || showCoachSplit || ctx.canManageShifts || ctx.canAssign;
          return (
            <div
              key={a.id}
              style={{
                background: "var(--mantine-color-gray-light)",
                borderRadius: "var(--mantine-radius-sm)",
                padding: "2px 4px 2px 8px",
              }}
            >
              <Text size="sm" fw={600} lineClamp={1}>
                {a.person_name ?? `#${a.person_id}`}
              </Text>
              {hasControlsRow && (
                <Group gap={4} wrap="wrap" justify="flex-end" mt={2}>
                  {/* Today/live In/Out is only meaningful before the shift ends; a past
                      un-actioned shift shows "Not actioned" (tap the clock to record). */}
                  {a.attendance_status === "checked_in" && !isPast && <Badge size="xs" color="teal">In</Badge>}
                  {a.attendance_status === "checked_out" && <Badge size="xs" color="blue" variant="light">Out</Badge>}
                  {isPast && a.attendance_status !== "checked_out" && (
                    <Badge size="xs" color="orange" variant="light"
                      title="This past shift hasn't been checked in/out — record or reassign it">
                      Not actioned
                    </Badge>
                  )}
                  {showCoachSplit && (
                    <Tooltip
                      label={
                        a.coach_kind === "secondary"
                          ? `Assisting coach — paid ${Math.round((a.share ?? 1) * 100)}% of the lesson${ctx.canAssign ? " (tap to mark lead)" : ""}`
                          : `Lead coach — paid the full lesson${ctx.canAssign ? " (tap to mark assisting)" : ""}`
                      }
                      withArrow
                    >
                      <Badge
                        size="xs"
                        variant={a.coach_kind === "secondary" ? "filled" : "light"}
                        color={a.coach_kind === "secondary" ? "grape" : "blue"}
                        style={{ cursor: ctx.canAssign ? "pointer" : "default" }}
                        onClick={() =>
                          ctx.canAssign &&
                          ctx.onSetCoachKind(shift.id, a.id, a.coach_kind === "secondary" ? "primary" : "secondary")
                        }
                      >
                        {a.coach_kind === "secondary" ? `Assisting · ${Math.round((a.share ?? 1) * 100)}%` : "Lead"}
                      </Badge>
                    </Tooltip>
                  )}
                  {ctx.canManageShifts && (
                    <ActionIcon size="sm" variant="subtle" aria-label="Record attendance"
                      title="Record / correct attendance"
                      onClick={() => ctx.onRecordAttendance(shift, a.person_id, a.person_name ?? `#${a.person_id}`)}>
                      <IconClock size={14} />
                    </ActionIcon>
                  )}
                  {ctx.canAssign && (
                    <ActionIcon size="sm" variant="subtle" color="red"
                      onClick={() => ctx.onUnassign(shift.id, a.id)} aria-label="Remove">
                      <IconX size={14} />
                    </ActionIcon>
                  )}
                </Group>
              )}
            </div>
          );
        })}
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
