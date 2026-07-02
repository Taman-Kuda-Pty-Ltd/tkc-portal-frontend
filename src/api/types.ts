export interface Me {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  capabilities: string[];
}

export interface Role {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  capabilities: string[];
}

export interface Person {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: Role[];
}

export interface Activity {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
}

export type RecurrenceUnit = "daily" | "weekly" | "fortnightly" | "monthly";
export type ShiftStatus = "scheduled" | "cancelled";
export type AssignmentStatus = "assigned" | "confirmed" | "declined";

export interface TemplateSlot {
  id: number;
  template_id: number;
  activity_id: number;
  role_id: number | null;
  weekday: number | null;
  week_in_cycle: number | null;
  day_of_month: number | null;
  start_time: string;
  end_time: string;
  headcount: number;
  notes: string | null;
}

export interface Template {
  id: number;
  name: string;
  description: string | null;
  recurrence: RecurrenceUnit;
  is_active: boolean;
  slots: TemplateSlot[];
}

export interface TemplateApplyResult {
  requested_count: number;
  duplicate_count: number;
  created_count: number;
  created: Shift[];
}

export interface Assignment {
  id: number;
  shift_id: number;
  person_id: number;
  role_id: number | null;
  status: AssignmentStatus;
  note: string | null;
}

export interface Shift {
  id: number;
  activity_id: number;
  role_id: number | null;
  starts_at: string;
  ends_at: string;
  headcount: number;
  status: ShiftStatus;
  notes: string | null;
  source_template_id: number | null;
  assignments: Assignment[];
}
