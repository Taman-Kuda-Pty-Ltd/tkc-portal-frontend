import {
  Button, Checkbox, Divider, Group, Modal, NumberInput, SegmentedControl, Select,
  Stack, Text, Textarea, TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import { ACCOUNT_RELATIONSHIPS } from "../constants/relationships";
import type { AccountHolderRec, Person, StudentRec } from "../api/types";

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];
export const EXPERIENCE = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/** Register a student — as a new person, or as a context on an existing person (the
 * "onboard once" path). Optionally link an account holder. Reused across the app. */
export function StudentRegisterModal({ opened, onClose, fixedPersonId, fixedPersonName }: {
  opened: boolean; onClose: () => void; fixedPersonId?: number; fixedPersonName?: string;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"new" | "existing">(fixedPersonId ? "existing" : "new");
  const [personId, setPersonId] = useState<string | null>(fixedPersonId ? String(fixedPersonId) : null);
  const [given, setGiven] = useState(""); const [family, setFamily] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [height, setHeight] = useState<number | string>("");
  const [weight, setWeight] = useState<number | string>("");
  const [experience, setExperience] = useState<string | null>(null);
  const [medical, setMedical] = useState(""); const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState(""); const [photo, setPhoto] = useState(false);
  const [holderId, setHolderId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("Parent");

  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people"), enabled: !fixedPersonId });
  const holdersQ = useQuery({ queryKey: ["account-holders"], queryFn: () => api.get<AccountHolderRec[]>("/account-holders") });

  const saveM = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        gender, height_cm: height === "" ? null : Number(height),
        weight_kg: weight === "" ? null : Number(weight), riding_experience: experience,
        medical_notes: medical.trim() || null, allergies_dietary: allergies.trim() || null,
        notes: notes.trim() || null, photo_media_consent: photo,
      };
      if (mode === "existing") body.person_id = Number(personId);
      else { body.given_name = given.trim(); body.family_name = family.trim(); body.date_of_birth = dob ? dayjs(dob).format("YYYY-MM-DD") : null; }
      const student = await api.post<StudentRec>("/students", body);
      if (holderId) {
        await api.post(`/students/${student.id}/account-holders`, {
          account_holder_id: Number(holderId), relationship, is_billing: true, is_responsible: true,
        });
      }
      return student;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      notifications.show({ color: "teal", message: "Student registered." });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const canSave = mode === "existing" ? !!personId : (given.trim() && family.trim());
  const peopleOptions = (peopleQ.data ?? []).map((p) => ({ value: String(p.id), label: `${p.full_name}${p.email ? ` · ${p.email}` : ""}` }));

  return (
    <Modal opened={opened} onClose={onClose} title="Register a student" size="lg">
      <Stack>
        {fixedPersonId ? (
          <Text size="sm">Registering <b>{fixedPersonName}</b> as a student.</Text>
        ) : (
          <>
            <SegmentedControl fullWidth value={mode} onChange={(v) => setMode(v as "new" | "existing")}
              data={[{ value: "new", label: "New person" }, { value: "existing", label: "Existing person" }]} />
            {mode === "existing" ? (
              <Select label="Person" placeholder="Search people" data={peopleOptions} value={personId}
                onChange={setPersonId} searchable comboboxProps={{ withinPortal: true }} />
            ) : (
              <Group grow>
                <TextInput label="First name" value={given} onChange={(e) => setGiven(e.currentTarget.value)} required />
                <TextInput label="Last name" value={family} onChange={(e) => setFamily(e.currentTarget.value)} required />
              </Group>
            )}
          </>
        )}
        {mode === "new" && !fixedPersonId && (
          <Group grow>
            <DateInput label="Date of birth" value={dob} onChange={setDob} valueFormat="D MMM YYYY" clearable />
            <Select label="Gender" data={GENDERS} value={gender} onChange={setGender} clearable comboboxProps={{ withinPortal: true }} />
          </Group>
        )}

        <Divider label="Rider details" labelPosition="left" />
        <Group grow>
          <Select label="Riding experience" data={EXPERIENCE} value={experience} onChange={setExperience} clearable comboboxProps={{ withinPortal: true }} />
          <NumberInput label="Height (cm)" min={0} value={height} onChange={setHeight} />
          <NumberInput label="Weight (kg)" min={0} value={weight} onChange={setWeight} />
        </Group>
        <Textarea label="Medical conditions" autosize minRows={2} value={medical} onChange={(e) => setMedical(e.currentTarget.value)} />
        <Textarea label="Allergies / dietary" autosize minRows={1} value={allergies} onChange={(e) => setAllergies(e.currentTarget.value)} />
        <Textarea label="Notes" autosize minRows={1} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Checkbox label="Photo / media consent given" checked={photo} onChange={(e) => setPhoto(e.currentTarget.checked)} />

        <Divider label="Account holder (optional)" labelPosition="left" />
        <Group grow>
          <Select label="Link to account holder" placeholder="None" data={(holdersQ.data ?? []).map((h) => ({ value: String(h.id), label: h.name }))}
            value={holderId} onChange={setHolderId} clearable searchable comboboxProps={{ withinPortal: true }} />
          <Select label="Relationship" data={ACCOUNT_RELATIONSHIPS} value={relationship}
            onChange={(v) => v && setRelationship(v)} comboboxProps={{ withinPortal: true }} />
        </Group>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saveM.isPending} disabled={!canSave} onClick={() => saveM.mutate()}>Register</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
