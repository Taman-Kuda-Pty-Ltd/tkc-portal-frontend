import { ActionIcon, Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AccountHolderRec, StudentRec } from "../api/types";

export function StudentsSection() {
  const qc = useQueryClient();
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const q = useQuery({ queryKey: ["students"], queryFn: () => api.get<StudentRec[]>("/students") });
  const holdersQ = useQuery({ queryKey: ["account-holders"], queryFn: () => api.get<AccountHolderRec[]>("/account-holders") });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["students"] });
  const createM = useMutation({
    mutationFn: () =>
      api.post("/students", {
        given_name: given.trim(),
        family_name: family.trim(),
        date_of_birth: dob ? dayjs(dob).format("YYYY-MM-DD") : null,
      }),
    onSuccess: () => { invalidate(); setGiven(""); setFamily(""); setDob(null); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/students/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Students are people who take lessons. A child is just a person with no login; their
        responsible account holder is the contact and payer.
      </Text>
      <Group align="flex-end">
        <TextInput label="First name" value={given} onChange={(e) => setGiven(e.currentTarget.value)} />
        <TextInput label="Last name" value={family} onChange={(e) => setFamily(e.currentTarget.value)} />
        <DateInput label="Date of birth" value={dob} onChange={setDob} clearable valueFormat="D MMM YYYY" w={160} />
        <Button loading={createM.isPending} disabled={!given.trim() && !family.trim()} onClick={() => createM.mutate()}>
          Add student
        </Button>
      </Group>
      <Stack gap="sm">
        {(q.data ?? []).map((s) => (
          <StudentCard key={s.id} student={s} holders={holdersQ.data ?? []} onDelete={() => delM.mutate(s.id)} />
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No students yet.</Text>}
      </Stack>
    </Stack>
  );
}

function StudentCard({
  student,
  holders,
  onDelete,
}: {
  student: StudentRec;
  holders: AccountHolderRec[];
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [holderId, setHolderId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>("parent");
  const [editOpen, setEditOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["students"] });

  const linkM = useMutation({
    mutationFn: () =>
      api.post(`/students/${student.id}/account-holders`, {
        account_holder_id: Number(holderId),
        relationship,
        is_billing: true,
        is_responsible: true,
      }),
    onSuccess: () => { invalidate(); setHolderId(null); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const unlinkM = useMutation({
    mutationFn: (linkId: number) => api.del(`/students/${student.id}/account-holders/${linkId}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const selfManageM = useMutation({
    mutationFn: () => api.post("/account-holders", { person_id: student.person_id }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["account-holders"] });
      notifications.show({ color: "teal", message: `${student.name} now manages their own account.` });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const linkedIds = new Set(student.account_holders.map((a) => a.account_holder_id));
  const options = holders.filter((h) => !linkedIds.has(h.id)).map((h) => ({ value: String(h.id), label: h.name }));

  return (
    <Card withBorder>
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600}>{student.name}</Text>
          {student.is_minor && <Badge color="orange" variant="light">Minor</Badge>}
          {student.is_self_managing && <Badge color="teal" variant="light">Self-managing</Badge>}
          {student.date_of_birth && (
            <Text size="sm" c="dimmed">b. {dayjs(student.date_of_birth).format("D MMM YYYY")}</Text>
          )}
        </Group>
        <Group gap="xs">
          {!student.is_self_managing && !student.is_minor && (
            <Button size="xs" variant="subtle" loading={selfManageM.isPending}
              onClick={() => selfManageM.mutate()}>
              Make self-managing
            </Button>
          )}
          <ActionIcon variant="subtle" aria-label="Edit details" onClick={() => setEditOpen(true)}>
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={onDelete}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <StudentEditModal student={student} opened={editOpen} onClose={() => setEditOpen(false)} />


      {(student.riding_experience || student.height_cm || student.weight_kg || student.medical_notes) && (
        <Text size="sm" c="dimmed" mt={4}>
          {[
            student.riding_experience?.replace(/_/g, " "),
            student.height_cm ? `${student.height_cm}cm` : null,
            student.weight_kg ? `${student.weight_kg}kg` : null,
          ].filter(Boolean).join(" · ")}
          {student.medical_notes ? ` · medical: ${student.medical_notes}` : ""}
        </Text>
      )}

      <Text size="sm" fw={500} mt="sm">Account holders</Text>
      <Stack gap={4} mt={4}>
        {student.account_holders.length === 0 && (
          <Text size="sm" c={student.is_minor ? "orange" : "dimmed"}>
            {student.is_minor ? "A minor should have a responsible account holder." : "None (self-managing)."}
          </Text>
        )}
        {student.account_holders.map((a) => (
          <Group key={a.link_id} gap={6} wrap="nowrap">
            <Text size="sm">{a.name}</Text>
            <Badge size="xs" variant="light">{a.relationship}</Badge>
            {a.is_responsible && <Badge size="xs" color="teal" variant="light">responsible</Badge>}
            {a.is_billing && <Badge size="xs" color="blue" variant="light">billing</Badge>}
            <ActionIcon size="sm" color="red" variant="subtle" aria-label="Unlink"
              onClick={() => unlinkM.mutate(a.link_id)}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <Group align="flex-end" mt="xs">
        <Select placeholder="Account holder" data={options} value={holderId} onChange={setHolderId}
          searchable w={200} comboboxProps={{ withinPortal: true }} />
        <Select label={undefined} data={["parent", "guardian", "payer", "other"]} value={relationship}
          onChange={(v) => v && setRelationship(v)} w={120} comboboxProps={{ withinPortal: true }} />
        <Button variant="light" size="sm" loading={linkM.isPending} disabled={!holderId}
          onClick={() => linkM.mutate()}>
          Link
        </Button>
      </Group>
    </Card>
  );
}

const EXPERIENCE = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function StudentEditModal({ student, opened, onClose }: { student: StudentRec; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [experience, setExperience] = useState<string | null>(student.riding_experience);
  const [height, setHeight] = useState<number | string>(student.height_cm ?? "");
  const [weight, setWeight] = useState<number | string>(student.weight_kg ?? "");
  const [medical, setMedical] = useState(student.medical_notes ?? "");
  const [notes, setNotes] = useState(student.notes ?? "");
  useEffect(() => {
    setExperience(student.riding_experience);
    setHeight(student.height_cm ?? "");
    setWeight(student.weight_kg ?? "");
    setMedical(student.medical_notes ?? "");
    setNotes(student.notes ?? "");
  }, [student]);

  const saveM = useMutation({
    mutationFn: () =>
      api.patch(`/students/${student.id}`, {
        riding_experience: experience,
        height_cm: height === "" ? null : Number(height),
        weight_kg: weight === "" ? null : Number(weight),
        medical_notes: medical.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["students"] }); onClose(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit ${student.name}`}>
      <Stack>
        <Select label="Riding experience" data={EXPERIENCE} value={experience} onChange={setExperience}
          clearable comboboxProps={{ withinPortal: true }} />
        <Group grow>
          <NumberInput label="Height (cm)" min={0} value={height} onChange={setHeight} />
          <NumberInput label="Weight (kg)" min={0} value={weight} onChange={setWeight} />
        </Group>
        <Textarea label="Medical conditions" autosize minRows={2} value={medical}
          onChange={(e) => setMedical(e.currentTarget.value)} />
        <Textarea label="Notes" autosize minRows={1} value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
