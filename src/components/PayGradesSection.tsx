import {
  ActionIcon, Button, Card, Group, Modal, NumberInput, SegmentedControl, Select,
  Stack, Table, Text, TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconPencil, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Role } from "../api/types";

const AGES = [
  { value: "adult", label: "Adult" },
  { value: "junior_16", label: "Jr ≤16" },
  { value: "junior_17", label: "Jr 17" },
  { value: "junior_18", label: "Jr 18" },
  { value: "junior_19", label: "Jr 19" },
];
const BASES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
];

interface PayGradeRate {
  id: number; basis: string;
  weekday_rate: number; saturday_rate: number; sunday_rate: number; public_holiday_rate: number;
  from_date: string; to_date: string | null;
}
interface PayGrade {
  id: number; capacity_role_id: number; capacity_role_name: string | null; name: string;
  age_category: string; position: number; is_active: boolean; rates: PayGradeRate[];
}

function effectiveRate(g: PayGrade, basis: string, asAt: string): PayGradeRate | null {
  const rows = g.rates
    .filter((r) => r.basis === basis && r.from_date <= asAt && (!r.to_date || r.to_date >= asAt))
    .sort((a, b) => a.from_date.localeCompare(b.from_date));
  return rows.length ? rows[rows.length - 1] : null;
}

export function PayGradesSection() {
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [addRole, setAddRole] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addAge, setAddAge] = useState("adult");
  const gradesQ = useQuery({ queryKey: ["pay-grades"], queryFn: () => api.get<PayGrade[]>("/pay-grades") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });

  const createM = useMutation({
    mutationFn: () =>
      api.post("/pay-grades", {
        capacity_role_id: Number(addRole), name: addName.trim(), age_category: addAge,
        position: addName.trim().toLowerCase().startsWith("grade ") ? Number(addName.split(" ")[1]) || 0 : 0,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-grades"] }); setAddName(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const byRole = new Map<string, PayGrade[]>();
  for (const g of gradesQ.data ?? []) {
    const key = g.capacity_role_name ?? "—";
    (byRole.get(key) ?? byRole.set(key, []).get(key)!).push(g);
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">Pay grades by work type. Rates shown as effective today.</Text>
        <Button size="xs" variant="light" leftSection={<IconUpload size={14} />} onClick={() => setImportOpen(true)}>
          Import award
        </Button>
      </Group>

      {[...byRole.entries()].map(([role, grades]) => (
        <RoleRates key={role} roleName={role} grades={grades} />
      ))}
      {(gradesQ.data ?? []).length === 0 && <Text size="sm" c="dimmed">No grades yet.</Text>}

      <Card withBorder>
        <Text fw={600} size="sm" mb="xs">Add a grade</Text>
        <Group align="flex-end">
          <Select label="Work type" w={160} data={(rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
            value={addRole} onChange={setAddRole} searchable />
          <TextInput label="Name" placeholder="e.g. Grade 1" w={140} value={addName} onChange={(e) => setAddName(e.currentTarget.value)} />
          <Select label="Age" w={120} data={AGES} value={addAge} onChange={(v) => v && setAddAge(v)} />
          <Button loading={createM.isPending} disabled={!addRole || !addName.trim()} onClick={() => createM.mutate()}>Add</Button>
        </Group>
      </Card>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title="Import award rates">
        <Stack>
          <Text>
            Uploading an award pay guide to auto-build the rate table (for a manager to
            check) isn't implemented yet — it's planned for when the AI integration lands.
          </Text>
          <Text size="sm" c="dimmed">For now, rates are seeded/entered manually.</Text>
          <Group justify="flex-end"><Button onClick={() => setImportOpen(false)}>OK</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function RoleRates({ roleName, grades }: { roleName: string; grades: PayGrade[] }) {
  const [age, setAge] = useState("adult");
  const [basis, setBasis] = useState("full_time");
  const [edit, setEdit] = useState<PayGrade | null>(null);
  const asAt = dayjs().format("YYYY-MM-DD");
  const levels = grades.filter((g) => g.age_category === age).sort((a, b) => a.position - b.position);
  const money = (n: number | undefined) => (n == null ? "—" : `$${n.toFixed(2)}`);

  return (
    <Card withBorder>
      <Text fw={700} mb="xs">{roleName}</Text>
      <Group mb="sm" gap="lg">
        <SegmentedControl size="xs" data={AGES} value={age} onChange={setAge} />
        <SegmentedControl size="xs" data={BASES} value={basis} onChange={setBasis} />
      </Group>
      <Table striped withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Grade</Table.Th><Table.Th>Weekday</Table.Th><Table.Th>Sat</Table.Th>
            <Table.Th>Sun</Table.Th><Table.Th>Pub. hol.</Table.Th><Table.Th /></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {levels.length === 0 && (
            <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">No grades for this age.</Text></Table.Td></Table.Tr>
          )}
          {levels.map((g) => {
            const r = effectiveRate(g, basis, asAt);
            return (
              <Table.Tr key={g.id}>
                <Table.Td>{g.name}</Table.Td>
                <Table.Td>{money(r?.weekday_rate)}</Table.Td>
                <Table.Td>{money(r?.saturday_rate)}</Table.Td>
                <Table.Td>{money(r?.sunday_rate)}</Table.Td>
                <Table.Td>{money(r?.public_holiday_rate)}</Table.Td>
                <Table.Td>
                  <ActionIcon size="sm" variant="subtle" onClick={() => setEdit(g)}><IconPencil size={14} /></ActionIcon>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {edit && <GradeRatesModal grade={edit} basis={basis} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function GradeRatesModal({ grade, basis, onClose }: { grade: PayGrade; basis: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [b, setB] = useState(basis);
  const cur = effectiveRate(grade, b, dayjs().format("YYYY-MM-DD"));
  const [wd, setWd] = useState<number>(cur?.weekday_rate ?? 0);
  const [sat, setSat] = useState<number>(cur?.saturday_rate ?? 0);
  const [sun, setSun] = useState<number>(cur?.sunday_rate ?? 0);
  const [ph, setPh] = useState<number>(cur?.public_holiday_rate ?? 0);
  const [from, setFrom] = useState<Date | null>(new Date());
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pay-grades"] });

  const saveM = useMutation({
    mutationFn: () =>
      api.post(`/pay-grades/${grade.id}/rates`, {
        basis: b, weekday_rate: wd, saturday_rate: sat, sunday_rate: sun, public_holiday_rate: ph,
        from_date: dayjs(from).format("YYYY-MM-DD"),
      }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delGradeM = useMutation({
    mutationFn: () => api.del(`/pay-grades/${grade.id}`),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title={`${grade.name} — ${AGES.find((a) => a.value === grade.age_category)?.label}`}>
      <Stack>
        <Select label="Basis" data={BASES} value={b} onChange={(v) => v && setB(v)} />
        <Group grow>
          <NumberInput label="Weekday $/h" min={0} step={0.5} value={wd} onChange={(v) => setWd(Number(v) || 0)} />
          <NumberInput label="Sat $/h" min={0} step={0.5} value={sat} onChange={(v) => setSat(Number(v) || 0)} />
        </Group>
        <Group grow>
          <NumberInput label="Sun $/h" min={0} step={0.5} value={sun} onChange={(v) => setSun(Number(v) || 0)} />
          <NumberInput label="Pub. hol. $/h" min={0} step={0.5} value={ph} onChange={(v) => setPh(Number(v) || 0)} />
        </Group>
        <DateInput label="Effective from" value={from} onChange={setFrom} valueFormat="D MMM YYYY" />
        <Text size="xs" c="dimmed">Saves a new rate effective from this date (schedules a change).</Text>
        <Group justify="space-between">
          <Button variant="light" color="red" loading={delGradeM.isPending} onClick={() => delGradeM.mutate()}>Delete grade</Button>
          <Button loading={saveM.isPending} disabled={!from} onClick={() => saveM.mutate()}>Save rate</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
