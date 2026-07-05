import { ActionIcon, Badge, Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
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
          <ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={onDelete}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>

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
