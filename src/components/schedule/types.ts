import type { Dayjs } from "dayjs";
import type { Activity, Person, Shift } from "../../api/types";
import type { TimeFormat } from "../../settings/SettingsContext";

/** Shared handlers + lookups passed to every schedule view. */
export interface ScheduleCtx {
  activityById: Map<number, Activity>;
  personById: Map<number, Person>;
  peopleOptions: { value: string; label: string }[];
  canManageShifts: boolean;
  canAssign: boolean;
  timeFormat: TimeFormat;
  onOpenShift: (s: Shift) => void;
  onAddShift: (d: Dayjs) => void;
  onAssign: (shiftId: number, personId: number) => void;
  onUnassign: (shiftId: number, assignmentId: number) => void;
}

export interface ShiftVisual {
  color: string;
  label: string;
  assigned: number;
  needed: number;
  /** red = unassigned, yellow = under, teal = full */
  fillColor: "red" | "yellow" | "teal";
}

export function shiftVisual(shift: Shift, ctx: ScheduleCtx): ShiftVisual {
  const activity = ctx.activityById.get(shift.activity_id);
  const assigned = shift.assignments.length;
  const needed = shift.headcount;
  return {
    color: activity?.color ?? "#2f855a",
    label: shift.description || activity?.name || "Shift",
    assigned,
    needed,
    fillColor: assigned === 0 ? "red" : assigned < needed ? "yellow" : "teal",
  };
}
