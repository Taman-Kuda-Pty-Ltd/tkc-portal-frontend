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
  is_selectable?: boolean;
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
  list_name: string; // "Family, Given" for alphabetical lists
  gender?: string | null;
  roles: Role[];
  is_student?: boolean;
  is_account_holder?: boolean;
  // Work roles this person is actively engaged for (ASG-1) — used to prefer
  // genuinely-engaged assignees over mere role-holders.
  engaged_role_ids?: number[];
}

export interface ActivityHeading {
  id: number;
  activity_id: number;
  label: string;
  resource_kind: string;
  qualifying_role_id: number | null;
  count: number;
  position: number;
  is_active: boolean;
}

export interface Activity {
  id: number;
  slug: string;
  name: string;
  abbreviation: string | null;
  description: string | null;
  color: string | null;
  is_active: boolean;
  is_lesson: boolean;
  default_role_id: number | null;
  default_lesson_hours: number | null;
  variance_margin_hours: number | null;
  headings: ActivityHeading[];
}

export interface StudentAccountHolder {
  link_id: number;
  account_holder_id: number;
  name: string;
  relationship: string;
  is_billing: boolean;
  is_responsible: boolean;
}
export interface StudentRec {
  id: number;
  person_id: number;
  name: string;
  date_of_birth: string | null;
  is_minor: boolean;
  is_self_managing: boolean;
  notes: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  riding_experience: string | null;
  medical_notes: string | null;
  allergies_dietary: string | null;
  photo_media_consent: boolean;
  is_active: boolean;
  account_holders: StudentAccountHolder[];
}
export interface AccountHolderRec {
  id: number;
  person_id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  notes: string | null;
  is_active: boolean;
}

// OB-1: duplicate-check / people-search result.
export interface PersonMatch {
  id: number;
  name: string;
  email: string | null;
  date_of_birth: string | null;
  is_student: boolean;
  is_account_holder: boolean;
  match_reason: string;
}
export interface AccountCreated {
  account_holder_id: number;
  holder_person_id: number;
  student_ids: number[];
}

export interface NamedResource {
  id: number;
  name: string;
  is_active: boolean;
}

export type HorseType = "school" | "agisted" | "visiting";
export type HorseSex = "mare" | "gelding" | "stallion" | "colt" | "filly";
export type RiderLevel = "never_ridden" | "beginner" | "novice" | "intermediate" | "advanced";
export type HorseCareType = "worming" | "farrier" | "dental" | "vaccination";

export interface Horse {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
  type: HorseType;
  breed: string | null;
  colour: string | null;
  sex: HorseSex | null;
  date_of_birth: string | null;
  age_years: number | null;
  height_hh: number | null;
  microchip: string | null;
  brand: string | null;
  registration: string | null;
  markings: string | null;
  owner_person_id: number | null;
  owner_person_name: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  expected_departure: string | null;
  max_rider_weight_kg: number | null;
  rider_level_min: RiderLevel | null;
  rider_level_max: RiderLevel | null;
  disciplines: string | null;
  temperament: string | null;
  do_not_ride: boolean;
  do_not_ride_note: string | null;
  photo_key: string | null;
  document_key: string | null;
}

export interface HorseCare {
  id: number;
  horse_id: number;
  care_type: HorseCareType;
  performed_on: string;
  notes: string | null;
  next_due: string | null;
  product_name: string | null;
  effective_weeks: number | null;
}

export interface HorseCareDue {
  horse_id: number;
  horse_name: string;
  care_type: HorseCareType;
  last_done: string | null;
  next_due: string | null;
  is_overdue: boolean;
}

export interface SuitabilityResult {
  student_id: number;
  horse_id: number;
  warnings: string[];
}

export interface Ride {
  id: number;
  student_id: number;
  student_name: string | null;
  horse_id: number | null;
  horse_name: string | null;
  override_note?: string | null;
}

export interface Clash {
  kind: "horse" | "facility";
  name: string;
  shift_id: number;
  shift_label: string;
  starts_at: string;
  ends_at: string;
}

// DBL-1: a horse/coach double-booked across two overlapping published shifts.
export interface ShiftClash {
  shift_id: number;
  kind: "horse" | "coach";
  resource_name: string;
  starts_at: string;
  ends_at: string;
  other_shift_id: number;
  other_shift_label: string;
  other_starts_at: string;
  other_ends_at: string;
}

export type EngagementType = "employee" | "contractor" | "volunteer" | "other";
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
  onboarding_url?: string | null;
}

export interface OnboardingCredential {
  credential_type: CredentialType;
  identifier: string | null;
  state_of_issue: string | null;
  expires_on: string | null;
  image_key?: string | null;
}

export interface EngagementDetail {
  id: number;
  engagement_type: EngagementType;
  work_role_id: number | null;
  work_role_name: string | null;
  employment_basis: EmploymentBasis | null;
  position_title: string | null;
  start_date: string | null;
  end_date: string | null;
  end_reason: string | null;
  is_active: boolean;
  business: {
    legal_name: string | null;
    trading_name: string | null;
    abn: string | null;
    gst_registered: boolean;
  } | null;
  has_tax: boolean;
  has_super: boolean;
  has_bank: boolean;
  can_view_sensitive: boolean;
  tax: {
    tfn: string | null;
    tfn_not_provided: boolean;
    residency: TaxResidency;
    claim_tax_free_threshold: boolean;
    has_study_loan: boolean;
    extra_withholding: boolean;
  } | null;
  superannuation: {
    fund_type: SuperFundType;
    fund_name: string | null;
    fund_usi: string | null;
    fund_abn: string | null;
    member_number: string | null;
    esa: string | null;
    smsf_bank_bsb: string | null;
    smsf_bank_account: string | null;
  } | null;
  bank: {
    account_name: string | null;
    bank_name: string | null;
    bsb: string | null;
    account_number: string | null;
  } | null;
}

export interface PersonDetail {
  id: number;
  given_name: string;
  middle_names: string | null;
  family_name: string;
  preferred_name: string | null;
  full_name: string;
  email: string | null;
  mobile: string | null;
  sms_opt_in?: boolean;
  date_of_birth: string | null;
  is_active: boolean;
  onboarded: boolean;
  photo_key: string | null;
  is_student?: boolean;
  is_account_holder?: boolean;
  has_pin: boolean;
  has_password?: boolean;
  super_percent?: number | null;
  roles: Role[];
  address: {
    line1: string | null;
    line2: string | null;
    line3: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    country: string;
  } | null;
  emergency_contacts: { id: number; name: string; relationship: string | null; phone: string | null }[];
  credentials: {
    id: number;
    credential_type: CredentialType;
    label: string | null;
    identifier: string | null;
    state_of_issue: string | null;
    issued_on: string | null;
    expires_on: string | null;
    notes: string | null;
    image_key: string | null;
  }[];
  engagements: EngagementDetail[];
}

export interface OnboardingContext {
  kind: "staff" | "school_client";
  has_account: boolean;
  given_name: string;
  family_name: string;
  middle_names: string | null;
  preferred_name: string | null;
  email: string | null;
  mobile: string | null;
  date_of_birth: string | null;
  engagement_type: EngagementType;
  employment_basis: EmploymentBasis | null;
  position_title: string | null;
  start_date: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    line3: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
  } | null;
  emergency_contacts: { name: string; relationship: string | null; phone: string | null }[];
  credentials: OnboardingCredential[];
  expires_at: string;
  require_phone_verification: boolean;
  storage_configured?: boolean;
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
export type ShiftStatus = "draft" | "published" | "cancelled";
export type AssignmentStatus = "assigned" | "confirmed" | "declined";

export interface SlotRider {
  student_id: number;
  horse_id: number | null;
}

export interface ShiftTemplateSlot {
  id: number;
  shift_template_id: number;
  activity_id: number;
  role_id: number | null;
  assigned_person_ids: number[];
  riders: SlotRider[];
  abbreviation: string | null;
  title: string | null;
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

export interface ApplyPreviewItem {
  starts_at: string;
  ends_at: string;
  label: string;
  exists: boolean;
}

export interface ShiftTemplateApplyResult {
  requested_count: number;
  duplicate_count: number;
  created_count: number;
  preview: ApplyPreviewItem[];
  created: Shift[];
}

export interface Assignment {
  id: number;
  shift_id: number;
  person_id: number;
  person_name: string | null;
  heading_id: number | null;
  heading_label: string | null;
  role_id: number | null;
  role_name: string | null;
  status: AssignmentStatus;
  coach_kind: "primary" | "secondary";
  share: number;
  note: string | null;
  attendance_status: string | null;
}

export interface ShiftNote {
  id: number;
  shift_id: number;
  body: string;
  author_id: number | null;
  author_name: string | null;
  created_at: string;
}

export interface Shift {
  id: number;
  activity_id: number;
  role_id: number | null;
  abbreviation: string | null;
  title: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  headcount: number;
  status: ShiftStatus;
  approval_status: "approved" | "pending" | "rejected";
  facility_id: number | null;
  facility_name: string | null;
  pay_hours: number | null;
  published_at: string | null;
  source_shift_template_id: number | null;
  assignments: Assignment[];
  notes: ShiftNote[];
  heading_counts: { heading_id: number; count: number }[];
  rides: Ride[];
}
