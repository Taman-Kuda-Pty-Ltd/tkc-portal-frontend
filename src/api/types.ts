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
  given_name: string;
  middle_names: string | null;
  family_name: string;
  preferred_name: string | null;
  email: string | null;
  mobile: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  onboarded: boolean;
  full_name: string; // computed display name
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

export type StaffType = "employee" | "contractor" | "volunteer" | "other";
export type EmploymentBasis = "full_time" | "part_time" | "casual";
export type TaxResidency = "resident" | "non_resident" | "working_holiday_maker";
export type SuperFundType = "apra" | "smsf";
export type CredentialType =
  | "wwcc"
  | "first_aid"
  | "coaching"
  | "police_check"
  | "drivers_licence"
  | "other";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  id: number;
  person_id: number;
  status: InvitationStatus;
  expires_at: string;
  given_name: string;
  family_name: string;
  email: string | null;
  email_sent: boolean;
  email_error: string | null;
}

export interface OnboardingContext {
  given_name: string;
  family_name: string;
  email: string | null;
  mobile: string | null;
  staff_type: StaffType;
  expires_at: string;
}

export type SmtpSecurity = "none" | "starttls" | "ssl";

export interface EmailSettings {
  enabled: boolean;
  host: string | null;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  from_email: string | null;
  from_name: string | null;
  has_password: boolean;
}

export interface ScheduleLens {
  id: number;
  name: string;
  description: string | null;
  position: number;
  is_active: boolean;
  activity_ids: number[];
}

export type RecurrenceUnit = "daily" | "weekly" | "fortnightly" | "monthly";
export type ShiftStatus = "scheduled" | "cancelled";
export type AssignmentStatus = "assigned" | "confirmed" | "declined";

export interface ShiftTemplateSlot {
  id: number;
  shift_template_id: number;
  activity_id: number;
  role_id: number | null;
  description: string | null;
  weekday: number | null;
  week_in_cycle: number | null;
  day_of_month: number | null;
  start_time: string;
  end_time: string;
  headcount: number;
  notes: string | null;
}

export interface ShiftTemplate {
  id: number;
  name: string;
  description: string | null;
  recurrence: RecurrenceUnit;
  is_active: boolean;
  slots: ShiftTemplateSlot[];
}

export interface ShiftTemplateApplyResult {
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
  description: string | null;
  starts_at: string;
  ends_at: string;
  headcount: number;
  status: ShiftStatus;
  notes: string | null;
  source_shift_template_id: number | null;
  assignments: Assignment[];
}
