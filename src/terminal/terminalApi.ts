// Kiosk terminal API — authenticates with a device token (X-Terminal-Token),
// never the user JWT. The token is stored per-device in localStorage.

const KEY = "tkc_terminal_token";

export function getTerminalToken(): string | null {
  return localStorage.getItem(KEY);
}
export function setTerminalToken(t: string | null) {
  if (t) localStorage.setItem(KEY, t);
  else localStorage.removeItem(KEY);
}

export type TerminalType = "checkin" | "schedule";

export interface TerminalConfig {
  name: string;
  terminal_type: TerminalType;
}
export interface RosterPerson {
  id: number;
  display_name: string;
  status: "off" | "checked_in" | "checked_out";
  has_shift: boolean;
}
export interface TerminalAttendance {
  id: number;
  person_id: number;
  shift_id: number | null;
  checked_in_at: string;
  checked_out_at: string | null;
  hours_worked: number | null;
  notes: string | null;
  status: "checked_in" | "checked_out";
}
export interface ShiftBrief {
  shift_id: number;
  title: string | null;
  activity_name: string | null;
  starts_at: string;
  ends_at: string;
  description: string | null;
  coworkers: string[];
  attendance: TerminalAttendance | null;
  is_lesson: boolean;
  facility_name: string | null;
  riders: string[];
  completed: boolean;
}
export interface TerminalSession {
  person_id: number;
  display_name: string;
  shifts: ShiftBrief[];
  lessons: ShiftBrief[];
  coaching_attendance: TerminalAttendance | null;
}
export interface CoachLessonUpdate {
  shift_id: number;
  completed: boolean;
  notes: string | null;
}

export class TerminalError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function treq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Terminal-Token": getTerminalToken() ?? "" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/terminal${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const d = await res.json();
      detail = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
    } catch {
      /* keep */
    }
    throw new TerminalError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const terminalApi = {
  config: () => treq<TerminalConfig>("GET", "/config"),
  roster: () => treq<RosterPerson[]>("GET", "/roster"),
  session: (person_id: number, pin: string) =>
    treq<TerminalSession>("POST", "/session", { person_id, pin }),
  checkIn: (person_id: number, pin: string, shift_id: number) =>
    treq<TerminalAttendance>("POST", "/check-in", { person_id, pin, shift_id }),
  checkOut: (
    person_id: number,
    pin: string,
    shift_id: number,
    hours_worked: number | null,
    notes: string | null,
  ) => treq<TerminalAttendance>("POST", "/check-out", { person_id, pin, shift_id, hours_worked, notes }),
  coachCheckIn: (person_id: number, pin: string) =>
    treq<TerminalAttendance>("POST", "/coach-check-in", { person_id, pin }),
  coachCheckOut: (person_id: number, pin: string, lessons: CoachLessonUpdate[]) =>
    treq<TerminalAttendance>("POST", "/coach-check-out", { person_id, pin, lessons }),
};
