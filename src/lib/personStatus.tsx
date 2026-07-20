import { Badge } from "@mantine/core";

/** Minimal shape needed to classify a person's status — satisfied by both the
 *  People-list `Person` and the profile `PersonDetail`. */
export interface PersonStatusShape {
  is_active: boolean;
  onboarded: boolean;
  is_student?: boolean;
  is_account_holder?: boolean;
  roles: { id: number }[];
}

/** A "pure client" = holds a client context (student and/or account holder) and no
 *  worker/portal role. Client-ness is the context, not a role (client-role
 *  rationalisation), so this names the intent instead of a bare roles.length check. */
export function isPureClient(p: PersonStatusShape): boolean {
  return !!(p.is_student || p.is_account_holder) && p.roles.length === 0;
}

/** One person-status badge used by BOTH the People list and the profile, so a
 *  login-less client reads "Registered" (not "Invited") consistently everywhere. */
export function personStatusBadge(p: PersonStatusShape) {
  if (!p.is_active) return <Badge color="gray" variant="light">Disabled</Badge>;
  // A registered client with no login isn't "Invited" — they're "Registered".
  if (!p.onboarded && isPureClient(p)) return <Badge color="grape" variant="light">Registered</Badge>;
  if (!p.onboarded) return <Badge color="yellow" variant="light">Invited</Badge>;
  return <Badge color="teal" variant="light">Active</Badge>;
}
