export const WEEKDAYS = [
  { value: "0", label: "Monday" },
  { value: "1", label: "Tuesday" },
  { value: "2", label: "Wednesday" },
  { value: "3", label: "Thursday" },
  { value: "4", label: "Friday" },
  { value: "5", label: "Saturday" },
  { value: "6", label: "Sunday" },
];

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const RECURRENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
];

// Human labels for capability slugs (from the backend Capability enum).
export const CAPABILITY_LABELS: Record<string, string> = {
  manage_people: "Manage people",
  manage_roles: "Manage roles",
  manage_activities: "Manage activities",
  manage_templates: "Manage templates",
  manage_shifts: "Manage shifts",
  assign_staff: "Assign staff",
  view_schedule: "View schedule",
  check_in: "Check in / out",
  view_reports: "View reports",
};
