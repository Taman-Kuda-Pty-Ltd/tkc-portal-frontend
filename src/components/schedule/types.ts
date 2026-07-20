import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Activity, ActivityHeading, Person, Shift, ShiftClash } from "../../api/types";
import type { TimeFormat } from "../../settings/SettingsContext";

/** The target count for a heading on a shift — the shift's override or the default. */
export function effectiveCount(shift: Shift, heading: ActivityHeading): number {
  const o = shift.heading_counts.find((c) => c.heading_id === heading.id);
  return o ? o.count : heading.count;
}

/** Eligible-assignee options for a picker. Everyone active (and not already assigned)
 *  is selectable — a manager may need to force through someone who doesn't hold the
 *  slot's role (FORCE-ROLE-ASSIGN); the assigned row then shows a ROLE-MISMATCH badge.
 *  Ordering: engaged role-holders first, then role-holders, then non-role-holders last.
 *  Labels flag "not engaged" and "no <role>" so the choice is explicit. */
export function eligibleAssignees(
  people: Person[],
  requiredRole: number | null,
  assignedPersonIds: number[],
  roleName?: string | null,
): { value: string; label: string }[] {
  const avail = people
    .filter((p) => p.is_active)
    .filter((p) => !assignedPersonIds.includes(p.id));
  return avail
    .map((p) => {
      const hasRole = !requiredRole || p.roles.some((r) => r.id === requiredRole);
      const engagedRoles = p.engaged_role_ids ?? [];
      const engaged = requiredRole ? engagedRoles.includes(requiredRole) : true;
      // rank: 0 engaged role-holder · 1 role-holder · 2 not engaged · 3 no role
      const rank = !requiredRole ? 0 : !hasRole ? 3 : engaged ? 0 : engagedRoles.length === 0 ? 1 : 2;
      return { p, hasRole, engaged, rank };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ p, hasRole, engaged }) => ({
      value: String(p.id),
      label: !hasRole
        ? `${p.full_name} · no ${roleName ?? "role"}`
        : engaged || !requiredRole
        ? p.full_name
        : `${p.full_name} · not engaged`,
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
  /** CAL-SHIFT-TIMES: show start–end times on calendar chips. */
  showTimes?: boolean;
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

/** Two-letter initials for a person, preferring given+family, else parsing the
 *  display name. Used by the dynamic groom/coach abbreviations (ABBR-1). */
function personInitials(p: Person | undefined, fallbackName: string | null): string {
  if (p) {
    const init = ((p.given_name?.trim()[0] ?? "") + (p.family_name?.trim()[0] ?? "")).toUpperCase();
    if (init) return init;
  }
  const name = (p?.full_name ?? fallbackName ?? "").trim();
  if (!name) return "";
  const parts = name.split(/\s+/);
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** ABBR-1: derive a compact abbreviation live from the activity + current state
 *  (assignment / start time), used when the shift has no manual abbreviation.
 *   - Groom      → the activity's configured abbreviation, else "GR" (role-based,
 *                  NOT the assignee's initials — a groom is identified by the role)
 *   - Stablehand → "AM"/"PM" by start time
 *   - Lesson     → initials of the (lead) coach, else "L"
 *   - Other      → the activity's configured abbreviation, else "OTR"
 *  Never persisted — recomputed at render so it tracks assignment changes. */
export function autoAbbr(shift: Shift, activity: Activity | undefined, ctx: ScheduleCtx): string {
  const slug = activity?.slug;
  if (slug === "stablehand") {
    return dayjs(shift.starts_at).hour() < 12 ? "AM" : "PM";
  }
  if (slug === "groom") {
    return activity?.abbreviation || "GR";
  }
  if (activity?.is_lesson || slug === "lesson") {
    const coach =
      shift.assignments.find((a) => a.coach_kind === "primary") ?? shift.assignments[0];
    const init = coach ? personInitials(ctx.personById.get(coach.person_id), coach.person_name) : "";
    return init || "L";
  }
  return activity?.abbreviation || "OTR";
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
    // Manual abbreviation overrides; otherwise derive it live (ABBR-1).
    abbr: shift.abbreviation || autoAbbr(shift, activity, ctx),
    assigned,
    needed,
    fillColor: assigned === 0 ? "red" : assigned < needed ? "yellow" : "teal",
  };
}
