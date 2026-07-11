import {
  ActionIcon,
  Badge,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconClock, IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Activity, ActivityHeading, Assignment, Person, Role, Shift } from "../api/types";
import { effectiveCount, eligibleAssignees } from "./schedule/types";

/** Assign / edit staff for a shift, per heading. For lessons shared by two or more
 *  coaches it exposes an independent pay share and a (cosmetic) Lead/Assisting label.
 *  Self-contained: it runs its own queries + mutations and invalidates ["shifts"]. */
export function StaffAssign({
  shift,
  activity,
  canAssign,
  canManageShifts,
  onRecordAttendance,
  onChanged,
}: {
  shift: Shift;
  activity: Activity | undefined;
  canAssign: boolean;
  canManageShifts?: boolean;
  onRecordAttendance?: (shift: Shift, personId: number, personName: string) => void;
  // Fired after any assign/unassign/patch so a caller holding a local copy of the
  // shift (e.g. a just-created shift not yet in the query cache) can refresh it.
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["shifts"] }); onChanged?.(); };
  const onErr = (e: Error) => notifications.show({ color: "red", message: e.message });

  const assignM = useMutation({
    mutationFn: (v: { personId: number; headingId: number | null }) =>
      api.post(`/shifts/${shift.id}/assignments`, { person_id: v.personId, heading_id: v.headingId }),
    onSuccess: invalidate,
    onError: onErr,
  });
  const unassignM = useMutation({
    mutationFn: (assignmentId: number) => api.del(`/shifts/${shift.id}/assignments/${assignmentId}`),
    onSuccess: invalidate,
    onError: onErr,
  });
  const patchM = useMutation({
    mutationFn: (v: { assignmentId: number; body: Record<string, unknown> }) =>
      api.patch(`/shifts/${shift.id}/assignments/${v.assignmentId}`, v.body),
    onSuccess: invalidate,
    onError: onErr,
  });

  const headings = (activity?.headings ?? []).filter((h) => h.is_active);
  const isLesson = !!activity?.is_lesson;
  const people = (peopleQ.data ?? []).filter((p) => p.is_active);
  const roleName = (id: number | null) =>
    id ? rolesQ.data?.find((r) => r.id === id)?.name : undefined;

  return (
    <Stack gap="sm">
      {headings.length > 0 ? (
        headings.map((h) => (
          <HeadingGroup
            key={h.id}
            shift={shift}
            heading={h}
            isLesson={isLesson}
            people={people}
            roleName={roleName}
            canAssign={canAssign}
            canManageShifts={canManageShifts}
            onAssign={(personId) => assignM.mutate({ personId, headingId: h.id })}
            onUnassign={(id) => unassignM.mutate(id)}
            onPatch={(id, body) => patchM.mutate({ assignmentId: id, body })}
            onRecordAttendance={onRecordAttendance}
          />
        ))
      ) : (
        <HeadingGroup
          shift={shift}
          heading={null}
          isLesson={isLesson}
          people={people}
          roleName={roleName}
          canAssign={canAssign}
          canManageShifts={canManageShifts}
          onAssign={(personId) => assignM.mutate({ personId, headingId: null })}
          onUnassign={(id) => unassignM.mutate(id)}
          onPatch={(id, body) => patchM.mutate({ assignmentId: id, body })}
          onRecordAttendance={onRecordAttendance}
        />
      )}
    </Stack>
  );
}

function HeadingGroup({
  shift,
  heading,
  isLesson,
  people,
  roleName,
  canAssign,
  canManageShifts,
  onAssign,
  onUnassign,
  onPatch,
  onRecordAttendance,
}: {
  shift: Shift;
  heading: ActivityHeading | null;
  isLesson: boolean;
  people: Person[];
  roleName: (id: number | null) => string | undefined;
  canAssign: boolean;
  canManageShifts?: boolean;
  onAssign: (personId: number) => void;
  onUnassign: (assignmentId: number) => void;
  onPatch: (assignmentId: number, body: Record<string, unknown>) => void;
  onRecordAttendance?: (shift: Shift, personId: number, personName: string) => void;
}) {
  const assigned = shift.assignments.filter((a) =>
    heading ? a.heading_id === heading.id : a.heading_id === null,
  );
  const label = heading?.label ?? "Staff";
  const target = heading ? effectiveCount(shift, heading) : undefined;
  const requiredRole = heading?.qualifying_role_id ?? shift.role_id ?? null;
  const eligible = eligibleAssignees(
    people,
    requiredRole,
    assigned.map((a) => a.person_id),
  );
  // Lead/share controls only matter when a lesson is shared by two or more coaches.
  const showCoachSplit = isLesson && assigned.length >= 2;

  return (
    <div>
      <Group gap={6} mb={4} justify="space-between">
        <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: 0.6 }}>
          {label}
          {requiredRole && (
            <Text span size="xs" c="dimmed" tt="none" fw={400}>
              {" "}· {roleName(requiredRole) ?? "role"}
            </Text>
          )}
        </Text>
        {target !== undefined && (
          <Badge size="xs" variant="light" color={assigned.length >= target ? "teal" : "yellow"}>
            {assigned.length}/{target}
          </Badge>
        )}
      </Group>
      <Stack gap={6}>
        {assigned.length === 0 && <Text size="sm" c="dimmed">None assigned.</Text>}
        {assigned.map((a) => (
          <AssignedRow
            key={a.id}
            shift={shift}
            a={a}
            showCoachSplit={showCoachSplit}
            canAssign={canAssign}
            canManageShifts={canManageShifts}
            onUnassign={onUnassign}
            onPatch={onPatch}
            onRecordAttendance={onRecordAttendance}
          />
        ))}
        {canAssign && (
          <Select
            size="sm"
            variant="filled"
            placeholder={`Assign ${label.toLowerCase()}…`}
            leftSection={<IconPlus size={14} />}
            searchable
            data={eligible}
            value={null}
            nothingFoundMessage="No eligible people"
            onChange={(val) => val && onAssign(Number(val))}
            comboboxProps={{ withinPortal: true }}
          />
        )}
      </Stack>
    </div>
  );
}

function AssignedRow({
  shift,
  a,
  showCoachSplit,
  canAssign,
  canManageShifts,
  onUnassign,
  onPatch,
  onRecordAttendance,
}: {
  shift: Shift;
  a: Assignment;
  showCoachSplit: boolean;
  canAssign: boolean;
  canManageShifts?: boolean;
  onUnassign: (assignmentId: number) => void;
  onPatch: (assignmentId: number, body: Record<string, unknown>) => void;
  onRecordAttendance?: (shift: Shift, personId: number, personName: string) => void;
}) {
  const name = a.person_name ?? `#${a.person_id}`;
  const isLead = a.coach_kind !== "secondary";
  return (
    <Group
      justify="space-between"
      gap={6}
      wrap="nowrap"
      pl={8}
      pr={2}
      py={4}
      style={{ background: "var(--mantine-color-default)", borderRadius: "var(--mantine-radius-sm)" }}
    >
      <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
        {name}
      </Text>
      {a.attendance_status === "checked_in" && <Badge size="xs" color="teal">In</Badge>}
      {a.attendance_status === "checked_out" && <Badge size="xs" color="blue" variant="light">Out</Badge>}

      {showCoachSplit && (
        <>
          <Tooltip
            label={isLead ? "Lead coach — tap to mark assisting" : "Assisting coach — tap to mark lead"}
            withArrow
          >
            <Badge
              size="sm"
              variant={isLead ? "light" : "filled"}
              color={isLead ? "blue" : "grape"}
              style={{ cursor: canAssign ? "pointer" : "default" }}
              onClick={() =>
                canAssign &&
                onPatch(a.id, { coach_kind: isLead ? "secondary" : "primary" })
              }
            >
              {isLead ? "Lead" : "Assisting"}
            </Badge>
          </Tooltip>
          {canAssign ? (
            <NumberInput
              size="xs"
              w={92}
              min={0}
              max={100}
              step={5}
              suffix="%"
              aria-label={`${name} pay share`}
              value={Math.round((a.share ?? 1) * 100)}
              onChange={(v) => {
                const pct = Math.max(0, Math.min(100, Number(v) || 0));
                onPatch(a.id, { share: pct / 100 });
              }}
            />
          ) : (
            <Tooltip label="Share of the lesson's pay" withArrow>
              <Badge size="sm" variant="outline" color="gray">
                {Math.round((a.share ?? 1) * 100)}%
              </Badge>
            </Tooltip>
          )}
        </>
      )}

      {canManageShifts && onRecordAttendance && (
        <ActionIcon
          size="sm"
          variant="subtle"
          aria-label="Record attendance"
          title="Record / correct attendance"
          onClick={() => onRecordAttendance(shift, a.person_id, name)}
        >
          <IconClock size={14} />
        </ActionIcon>
      )}
      {canAssign && (
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          aria-label="Remove"
          onClick={() => onUnassign(a.id)}
        >
          <IconX size={14} />
        </ActionIcon>
      )}
    </Group>
  );
}
