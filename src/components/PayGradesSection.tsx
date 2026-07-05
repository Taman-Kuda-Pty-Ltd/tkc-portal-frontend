import { ActionIcon, Badge, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Role } from "../api/types";

const BASES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
];
const basisLabel = (v: string) => BASES.find((b) => b.value === v)?.label ?? v;

interface PayGradeRate {
  id: number; basis: string;
  weekday_rate: number; saturday_rate: number; sunday_rate: number; public_holiday_rate: number;
  from_date: string; to_date: string | null;
}
interface PayGrade { id: number; capacity_role_id: number; capacity_role_name: string | null; name: string; is_active: boolean; rates: PayGradeRate[] }

export function PayGradesSection() {
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const gradesQ = useQuery({ queryKey: ["pay-grades"], queryFn: () => api.get<PayGrade[]>("/pay-grades") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pay-grades"] });

  const createM = useMutation({
    mutationFn: () => api.post("/pay-grades", { capacity_role_id: Number(roleId), name: name.trim() }),
    onSuccess: () => { invalidate(); setName(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Employee pay grades per work type. Each grade has full-time / part-time / casual
        rates with separate weekday, Saturday, Sunday and public-holiday amounts, each
        effective from a date (add a future-dated row to schedule a change).
      </Text>
      <Group align="flex-end">
        <Select label="Work type" placeholder="Role" w={180}
          data={(rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
          value={roleId} onChange={setRoleId} searchable />
        <TextInput label="Grade name" placeholder="e.g. Grade 1" value={name}
          onChange={(e) => setName(e.currentTarget.value)} />
        <Button loading={createM.isPending} disabled={!roleId || !name.trim()} onClick={() => createM.mutate()}>
          Add grade
        </Button>
      </Group>
      <Stack gap="sm">
        {(gradesQ.data ?? []).map((g) => <GradeCard key={g.id} grade={g} />)}
        {(gradesQ.data ?? []).length === 0 && <Text size="sm" c="dimmed">No grades yet.</Text>}
      </Stack>
    </Stack>
  );
}

function GradeCard({ grade }: { grade: PayGrade }) {
  const qc = useQueryClient();
  const [basis, setBasis] = useState("casual");
  const [wd, setWd] = useState<number>(0);
  const [sat, setSat] = useState<number>(0);
  const [sun, setSun] = useState<number>(0);
  const [ph, setPh] = useState<number>(0);
  const [from, setFrom] = useState<Date | null>(new Date());
  const [to, setTo] = useState<Date | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pay-grades"] });

  const addRateM = useMutation({
    mutationFn: () => api.post(`/pay-grades/${grade.id}/rates`, {
      basis, weekday_rate: wd, saturday_rate: sat, sunday_rate: sun, public_holiday_rate: ph,
      from_date: dayjs(from).format("YYYY-MM-DD"), to_date: to ? dayjs(to).format("YYYY-MM-DD") : null,
    }),
    onSuccess: () => { invalidate(); setWd(0); setSat(0); setSun(0); setPh(0); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delRateM = useMutation({
    mutationFn: (id: number) => api.del(`/pay-grades/rates/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delGradeM = useMutation({
    mutationFn: () => api.del(`/pay-grades/${grade.id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Badge variant="light">{grade.capacity_role_name}</Badge>
          <Text fw={600}>{grade.name}</Text>
        </Group>
        <ActionIcon color="red" variant="subtle" onClick={() => delGradeM.mutate()} aria-label="Delete grade">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      <Table striped withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Basis</Table.Th>
            <Table.Th>Weekday</Table.Th>
            <Table.Th>Sat</Table.Th>
            <Table.Th>Sun</Table.Th>
            <Table.Th>Pub. hol.</Table.Th>
            <Table.Th>Effective</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {grade.rates.length === 0 && (
            <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" size="sm">No rates set.</Text></Table.Td></Table.Tr>
          )}
          {grade.rates.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{basisLabel(r.basis)}</Table.Td>
              <Table.Td>{money(r.weekday_rate)}</Table.Td>
              <Table.Td>{money(r.saturday_rate)}</Table.Td>
              <Table.Td>{money(r.sunday_rate)}</Table.Td>
              <Table.Td>{money(r.public_holiday_rate)}</Table.Td>
              <Table.Td>
                {dayjs(r.from_date).format("D MMM YY")}{r.to_date ? `–${dayjs(r.to_date).format("D MMM YY")}` : "+"}
              </Table.Td>
              <Table.Td>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delRateM.mutate(r.id)}>
                  <IconX size={12} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group align="flex-end" mt="xs" gap="xs">
        <Select label="Basis" w={110} data={BASES} value={basis} onChange={(v) => v && setBasis(v)} comboboxProps={{ withinPortal: true }} />
        <NumberInput label="Weekday" w={90} min={0} step={0.5} value={wd} onChange={(v) => setWd(Number(v) || 0)} />
        <NumberInput label="Sat" w={80} min={0} step={0.5} value={sat} onChange={(v) => setSat(Number(v) || 0)} />
        <NumberInput label="Sun" w={80} min={0} step={0.5} value={sun} onChange={(v) => setSun(Number(v) || 0)} />
        <NumberInput label="Pub. hol." w={90} min={0} step={0.5} value={ph} onChange={(v) => setPh(Number(v) || 0)} />
        <DateInput label="From" w={130} value={from} onChange={setFrom} valueFormat="D MMM YYYY" />
        <DateInput label="To" w={120} value={to} onChange={setTo} clearable valueFormat="D MMM YYYY" />
        <Button size="sm" variant="light" loading={addRateM.isPending} disabled={!from} onClick={() => addRateM.mutate()}>Add rate</Button>
      </Group>
    </Card>
  );
}
