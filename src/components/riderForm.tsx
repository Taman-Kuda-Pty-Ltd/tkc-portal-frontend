import {
  Alert, Button, Card, Checkbox, Divider, Group, NumberInput, Select, SimpleGrid,
  Stack, Text, Textarea, TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { PersonMatch } from "../api/types";
import { DateField } from "./DateField";
import { PhoneField } from "./PhoneField";

export const EXPERIENCE = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];
// Shared, capitalised relationship lists (UAT#3 REL-CONSIST/REL-CASING).
import {
  ACCOUNT_RELATIONSHIPS, GUARDIAN_RELATIONSHIPS,
  RELATIONSHIPS as EC_RELATIONSHIPS,
} from "../constants/relationships";
export const RELATIONSHIPS = ACCOUNT_RELATIONSHIPS; // rider ↔ account-holder link
export { GUARDIAN_RELATIONSHIPS };

export function ageFrom(dob: Date | string | null): number | null {
  if (!dob) return null;
  const d = dayjs(dob);
  return d.isValid() ? dayjs().diff(d, "year") : null;
}
export function isMinorDob(dob: Date | string | null): boolean {
  const a = ageFrom(dob);
  return a !== null && a < 18;
}

export interface RiderDraft {
  key: string;
  mode: "new" | "existing";
  person_id: number | null;
  person_dob: string | null; // DOB of a chosen existing person (for minor calc)
  is_holder: boolean;
  given_name: string;
  family_name: string;
  date_of_birth: Date | null;
  gender: string | null;
  height_cm: number | "";
  weight_kg: number | "";
  riding_experience: string | null;
  medical_notes: string;
  allergies_dietary: string;
  photo_media_consent: boolean;
  notes: string;
  relationship: string;
  // Emergency contact (EMER, students-only) — required for every rider. May be the
  // account holder (ec_is_holder) except for a self-managing holder-rider.
  ec_is_holder: boolean;
  ec_name: string;
  ec_relationship: string;
  ec_phone: string;
  // Guardian (minors) — defaults to the account holder.
  guardian_is_holder: boolean;
  guardian_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_email: string;
}

let seq = 0;
export const emptyRider = (patch: Partial<RiderDraft> = {}): RiderDraft => ({
  key: `r${seq++}`,
  mode: "new", person_id: null, person_dob: null, is_holder: false,
  given_name: "", family_name: "", date_of_birth: null, gender: null,
  height_cm: "", weight_kg: "", riding_experience: null,
  medical_notes: "", allergies_dietary: "", photo_media_consent: false, notes: "",
  relationship: "parent",
  ec_is_holder: true, ec_name: "", ec_relationship: "", ec_phone: "",
  guardian_is_holder: true, guardian_name: "", guardian_relationship: "",
  guardian_phone: "", guardian_email: "",
  ...patch,
});

/** Rider effective DOB for the minor check — the typed one (new) or the chosen person's. */
export function riderDob(r: RiderDraft): Date | string | null {
  return r.mode === "existing" ? r.person_dob : r.date_of_birth;
}

/** Serialise a rider draft to the RiderIn payload the backend expects. */
export function riderPayload(r: RiderDraft): Record<string, unknown> {
  const minor = isMinorDob(riderDob(r));
  const body: Record<string, unknown> = {
    is_holder: r.is_holder,
    height_cm: r.height_cm === "" ? null : Number(r.height_cm),
    weight_kg: r.weight_kg === "" ? null : Number(r.weight_kg),
    riding_experience: r.riding_experience,
    medical_notes: r.medical_notes.trim() || null,
    allergies_dietary: r.allergies_dietary.trim() || null,
    notes: r.notes.trim() || null,
    photo_media_consent: r.photo_media_consent,
    relationship: r.relationship,
  };
  // Emergency contact (students-only): a self-managing holder-rider can't nominate
  // themselves, so ec_is_holder only applies to non-holder riders.
  const ecIsHolder = r.ec_is_holder && !r.is_holder;
  body.emergency_contact_is_holder = ecIsHolder;
  body.emergency_contact = ecIsHolder
    ? null
    : { name: r.ec_name.trim(), relationship: r.ec_relationship || null, phone: r.ec_phone || null };
  if (!r.is_holder) {
    if (r.mode === "existing") body.person_id = r.person_id;
    else {
      body.given_name = r.given_name.trim();
      body.family_name = r.family_name.trim();
      body.date_of_birth = r.date_of_birth ? dayjs(r.date_of_birth).format("YYYY-MM-DD") : null;
      body.gender = r.gender;
    }
  }
  if (minor) {
    // When the guardian is the account holder, leave phone/email null — the backend
    // fills them from the holder (GUARDIAN-LOCK), so they can't drift out of sync.
    body.guardian = {
      guardian_name: r.guardian_is_holder ? null : r.guardian_name.trim() || null,
      relationship: r.guardian_relationship || null,
      phone: r.guardian_is_holder ? null : r.guardian_phone || null,
      email: r.guardian_is_holder ? null : r.guardian_email.trim() || null,
    };
  }
  return body;
}

/** Validate a rider draft. Returns an error string, or null if valid. `holderKnown`
 * means the account holder is available to default the guardian to. */
export function validateRider(r: RiderDraft): string | null {
  if (!r.is_holder) {
    if (r.mode === "existing" && !r.person_id) return "Choose an existing person for the rider, or add a new one.";
    if (r.mode === "new" && (!r.given_name.trim() || !r.family_name.trim())) return "Enter each rider's first and last name.";
    if (r.mode === "new" && !r.date_of_birth) return "Each rider needs a date of birth.";
  }
  // EMER (students-only): every rider needs an emergency contact unless they nominated
  // the account holder (not available to a self-managing holder-rider).
  const ecIsHolder = r.ec_is_holder && !r.is_holder;
  if (!ecIsHolder && !r.ec_name.trim()) return "Each rider needs an emergency contact.";
  if (isMinorDob(riderDob(r))) {
    if (!r.guardian_relationship) return "Choose the guardian's relationship for the minor rider.";
    // When the guardian is the account holder, their phone/email come from the holder,
    // so they aren't required on the rider row (GUARDIAN-LOCK).
    if (!r.guardian_is_holder) {
      if (!r.guardian_phone) return "The guardian needs a phone number.";
      if (!r.guardian_email.trim()) return "The guardian needs an email.";
      if (!r.guardian_name.trim()) return "Enter the guardian's name.";
    }
  }
  return null;
}

/** Async name search over /people-search, surfaced as a searchable Select. */
export function PersonSearchSelect({
  label, value, onPick, placeholder,
}: {
  label?: string;
  value: PersonMatch | null;
  onPick: (p: PersonMatch | null) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["people-search", term],
    queryFn: () => api.get<PersonMatch[]>(`/people-search?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
  });
  const results = q.data ?? [];
  const data = results.map((p) => ({
    value: String(p.id),
    label: `${p.name}${p.email ? ` · ${p.email}` : ""}${p.date_of_birth ? ` · b.${dayjs(p.date_of_birth).format("YYYY")}` : ""}`,
  }));
  // Keep the current selection visible even when the search term changes.
  if (value && !data.some((d) => d.value === String(value.id))) {
    data.unshift({ value: String(value.id), label: value.name });
  }
  return (
    <Select
      label={label}
      placeholder={placeholder ?? "Type a name to search"}
      data={data}
      searchable
      clearable
      value={value ? String(value.id) : null}
      searchValue={term}
      onSearchChange={setTerm}
      nothingFoundMessage={term.trim().length >= 2 ? "No matches" : "Type at least 2 letters"}
      onChange={(v) => onPick(v ? (results.find((p) => String(p.id) === v) ?? value) : null)}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

/** The core + rider-profile + guardian fields for a single rider. Shared by the
 * new-account page and the add-rider-to-existing-account modal. */
export function RiderFields({
  rider, update, holderName, holderPhone, holderEmail,
}: {
  rider: RiderDraft;
  update: (patch: Partial<RiderDraft>) => void;
  holderName?: string;
  holderPhone?: string;
  holderEmail?: string;
}) {
  const [dupes, setDupes] = useState<PersonMatch[] | null>(null);
  const r = rider;
  const minor = isMinorDob(riderDob(r));

  // Duplicate guard: when a new rider has a name + DOB, check for existing people.
  const runDupCheck = async () => {
    if (r.mode !== "new" || !r.given_name.trim() || !r.family_name.trim() || !r.date_of_birth) return;
    try {
      const matches = await api.post<PersonMatch[]>("/people/match", {
        given_name: r.given_name.trim(),
        family_name: r.family_name.trim(),
        date_of_birth: dayjs(r.date_of_birth).format("YYYY-MM-DD"),
      });
      setDupes(matches.length ? matches : null);
    } catch {
      setDupes(null);
    }
  };

  return (
    <Stack gap="sm">
      {!r.is_holder && (
        <Group gap="xs">
          <Button size="xs" variant={r.mode === "existing" ? "filled" : "light"}
            onClick={() => update({ mode: "existing" })}>Search existing</Button>
          <Button size="xs" variant={r.mode === "new" ? "filled" : "light"}
            onClick={() => update({ mode: "new", person_id: null, person_dob: null })}>Add new</Button>
        </Group>
      )}

      {!r.is_holder && r.mode === "existing" && (
        <PersonSearchSelect
          label="Rider"
          value={r.person_id ? { id: r.person_id, name: `${r.given_name} ${r.family_name}`.trim() || "Selected", email: null, date_of_birth: r.person_dob, is_student: false, is_account_holder: false, match_reason: "" } : null}
          onPick={(p) => update({
            person_id: p?.id ?? null,
            person_dob: p?.date_of_birth ?? null,
            given_name: p?.name ?? "",
            family_name: "",
          })}
        />
      )}

      {!r.is_holder && r.mode === "new" && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="First name" required value={r.given_name}
              onChange={(e) => update({ given_name: e.currentTarget.value })} onBlur={runDupCheck} />
            <TextInput label="Last name" required value={r.family_name}
              onChange={(e) => update({ family_name: e.currentTarget.value })} onBlur={runDupCheck} />
            <DateField label="Date of birth" value={r.date_of_birth} required
              onChange={(d) => update({ date_of_birth: d })} onBlur={runDupCheck} />
            <Select label="Gender" data={GENDERS} value={r.gender}
              onChange={(v) => update({ gender: v })} clearable comboboxProps={{ withinPortal: true }} />
          </SimpleGrid>
          {dupes && (
            <Alert color="yellow" title="Possible existing match">
              <Text size="sm" mb="xs">
                Someone with this name/date of birth may already exist. Link to them instead of creating a duplicate?
              </Text>
              <Stack gap={4}>
                {dupes.map((d) => (
                  <Group key={d.id} justify="space-between">
                    <Text size="sm">{d.name}{d.email ? ` · ${d.email}` : ""}</Text>
                    <Button size="xs" variant="light" onClick={() => {
                      update({ mode: "existing", person_id: d.id, person_dob: d.date_of_birth, given_name: d.name, family_name: "" });
                      setDupes(null);
                    }}>Link this person</Button>
                  </Group>
                ))}
                <Group>
                  <Button size="xs" variant="subtle" onClick={() => setDupes(null)}>Create new anyway</Button>
                </Group>
              </Stack>
            </Alert>
          )}
        </>
      )}

      <Divider label="Rider details" labelPosition="left" />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Select label="Rider level" data={EXPERIENCE} value={r.riding_experience}
          onChange={(v) => update({ riding_experience: v })} clearable comboboxProps={{ withinPortal: true }} />
        <NumberInput label="Height (cm)" min={0} value={r.height_cm}
          onChange={(v) => update({ height_cm: v === "" ? "" : Number(v) })} />
        <NumberInput label="Weight (kg)" min={0} value={r.weight_kg}
          onChange={(v) => update({ weight_kg: v === "" ? "" : Number(v) })} />
      </SimpleGrid>
      <Textarea label="Medical conditions to disclose" autosize minRows={2}
        value={r.medical_notes} onChange={(e) => update({ medical_notes: e.currentTarget.value })} />
      <Textarea label="Allergies / dietary needs" autosize minRows={1}
        value={r.allergies_dietary} onChange={(e) => update({ allergies_dietary: e.currentTarget.value })} />
      <Textarea label="Notes" autosize minRows={1}
        value={r.notes} onChange={(e) => update({ notes: e.currentTarget.value })} />
      <Checkbox label="Photo / media consent given" checked={r.photo_media_consent}
        onChange={(e) => update({ photo_media_consent: e.currentTarget.checked })} />

      <Divider label="Emergency contact" labelPosition="left" />
      {/* EMER (students-only): every rider needs an emergency contact. A non-holder rider
          may nominate the account holder; a self-managing holder-rider must name their own. */}
      {!r.is_holder && (
        <Select label="Emergency contact" allowDeselect={false} comboboxProps={{ withinPortal: true }}
          data={[
            { value: "holder", label: holderName ? `${holderName} (account holder)` : "Account holder" },
            { value: "other", label: "Someone else" },
          ]}
          value={r.ec_is_holder ? "holder" : "other"}
          onChange={(v) => update({ ec_is_holder: v === "holder" })} />
      )}
      {(!r.ec_is_holder || r.is_holder) && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Name" required value={r.ec_name}
            onChange={(e) => update({ ec_name: e.currentTarget.value })} />
          <Select label="Relationship" data={EC_RELATIONSHIPS} value={r.ec_relationship || null}
            placeholder="Select" clearable comboboxProps={{ withinPortal: true }}
            onChange={(v) => update({ ec_relationship: v ?? "" })} />
          <PhoneField label="Phone" value={r.ec_phone} onChange={(v) => update({ ec_phone: v })} />
        </SimpleGrid>
      )}
      {r.ec_is_holder && !r.is_holder && (
        <Text size="xs" c="dimmed">Uses the account holder as the emergency contact.</Text>
      )}

      {minor && (
        <Card withBorder bg="var(--mantine-color-gray-light)">
          <Text fw={600} size="sm" mb="xs">Guardian (this rider is a minor)</Text>
          <Select label="Guardian" data={[
            { value: "holder", label: holderName ? `${holderName} (account holder)` : "Account holder" },
            { value: "other", label: "Someone else" },
          ]} value={r.guardian_is_holder ? "holder" : "other"}
            onChange={(v) => update({
              guardian_is_holder: v === "holder",
              guardian_name: v === "holder" ? "" : r.guardian_name,
              guardian_phone: v === "holder" ? (holderPhone ?? "") : r.guardian_phone,
              guardian_email: v === "holder" ? (holderEmail ?? "") : r.guardian_email,
            })}
            comboboxProps={{ withinPortal: true }} allowDeselect={false} />
          <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
            {!r.guardian_is_holder && (
              <TextInput label="Guardian name" required value={r.guardian_name}
                onChange={(e) => update({ guardian_name: e.currentTarget.value })} />
            )}
            <Select label="Relationship" required data={GUARDIAN_RELATIONSHIPS}
              value={r.guardian_relationship || null}
              onChange={(v) => update({ guardian_relationship: v ?? "" })}
              comboboxProps={{ withinPortal: true }} />
            {/* GUARDIAN-LOCK: when the guardian IS the account holder, their phone/email
                are locked to the holder's — not independently editable. */}
            <PhoneField label="Guardian phone" required value={r.guardian_is_holder ? (holderPhone ?? "") : r.guardian_phone}
              disabled={r.guardian_is_holder}
              onChange={(v) => update({ guardian_phone: v })} />
            <TextInput label="Guardian email" required type="email"
              value={r.guardian_is_holder ? (holderEmail ?? "") : r.guardian_email}
              disabled={r.guardian_is_holder}
              onChange={(e) => update({ guardian_email: e.currentTarget.value })} />
          </SimpleGrid>
          {r.guardian_is_holder && (
            <Text size="xs" c="dimmed" mt={4}>Uses the account holder's phone and email.</Text>
          )}
        </Card>
      )}
    </Stack>
  );
}
