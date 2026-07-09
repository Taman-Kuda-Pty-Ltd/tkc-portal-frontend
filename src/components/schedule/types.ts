import type { Dayjs } from "dayjs";
import type { Activity, ActivityHeading, Person, Shift, ShiftClash } from "../../api/types";
import type { TimeFormat } from "../../settings/SettingsContext";

/** The target count for a heading on a shift — the shift's override or the default. */
export function effectiveCount(shift: Shift, heading: ActivityHeading): number {
  const o = shift.heading_counts.find((c) => c.heading_id === heading.id);
  return o ? o.count : heading.count;
}

/** Eligible-assignee options for a picker, filtered by the required role AND active
 *  engagement (ASG-1). Prefers people engaged for the role; keeps role-holders with
 *  no engagement data (ambiguous — never hard-blocks); drops those engaged only for
 *  another role. Non-engaged people shown are labelled and sorted last. */
export function eligibleAssignees(
  people: Person[],
  requiredRole: number | null,
  assignedPersonIds: number[],
): { value: string; label: string }[] {
  const avail = people
    .filter((p) => p.is_active)
    .filter((p) => !assignedPersonIds.includes(p.id));
  const withRole = requiredRole
    ? avail.filter((p) => p.roles.some((r) => r.id === requiredRole))
    : avail;
  return withRole
    .map((p) => {
      const engagedRoles = p.engaged_role_ids ?? [];
      const engaged = requiredRole ? engagedRoles.includes(requiredRole) : true;
      const keep = !requiredRole || engaged || engagedRoles.length === 0;
      return { p, engaged, keep };
    })
    .filter((x) => x.keep)
    .sort((a, b) => (a.engaged === b.engaged ? 0 : a.engaged ? -1 : 1))
    .map(({ p, engaged }) => ({
      value: String(p.id),
      label: engaged ? p.full_name : `${p.full_name} · not engaged`,
    }));
}

/** Shared handlers + lookups passed to every schedule view. */
export interface ScheduleCtx {
  activityById: Map<number, Activity>;
  personById: Map<number, Person>;
  peopleOptions: { value: string; label: string }[];
  canManageShifts: boolean;
  canAssign: boolean;
  timeFormat: TimeFormat;
  /** Double-booked horses/coaches keyed by shift id (DBL-1). */
  clashByShift?: Map<number, ShiftClash[]>;
  /** A recently-created/targeted shift to highlight + scroll to (SC-7 / SC-11). */
  highlightShiftId?: number | null;
  onOpenShift: (s: Shift) => void;
  onAddShift: (d: Dayjs) => void;
  onAssign: (shiftId: number, personId: number, headingId: number | null) => void;
  onUnassign: (shiftId: number, assignmentId: number) => void;
  onSetCoachKind: (shiftId: number, assignmentId: number, kind: "primary" | "secondary") => void;
  onRecordAttendance: (shift: Shift, personId: number, personName: string) => void;
}

export interface ShiftVisual {
  color: string;
  /** Short label for week/day views (title, falling back to the activity name). */
  label: string;
  /** Very compact label for month view. */
  abbr: string;
  assigned: number;
  needed: number;
  /** red = unassigned, yellow = under, teal = full */
  fillColor: "red" | "yellow" | "teal";
}

export function shiftVisual(shift: Shift, ctx: ScheduleCtx): ShiftVisual {
  const activity = ctx.activityById.get(shift.activity_id);
  const headings = (activity?.headings ?? []).filter((h) => h.is_active);
  const assigned = shift.assignments.length;
  const needed = headings.length
    ? headings.reduce((sum, h) => sum + effectiveCount(shift, h), 0)
    : shift.headcount;
  const label = shift.title || activity?.name || "Shift";
  return {
    color: activity?.color ?? "#2f855a",
    label,
    abbr: shift.abbreviation || activity?.abbreviation || label,
    assigned,
    needed,
    fillColor: assigned === 0 ? "red" : assigned < needed ? "yellow" : "teal",
  };
}
