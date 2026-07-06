import { ActionIcon, Badge, Button, Card, Checkbox, Divider, Group, NumberInput, Select, Stack, Table, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Activity } from "../api/types";

const BASES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
];

interface EmployeeGrade { id: number; pay_grade_id: number; grade_name: string | null; age_category: string | null; capacity_role_name: string | null; basis: string; from_date: string; to_date: string | null }
interface ContractorRate {
  id: number; activity_id: number; activity_name: string | null;
  weekday_rate: number; saturday_rate: number; sunday_rate: number; public_holiday_rate: number;
  from_date: string;
}
interface PayGrade { id: number; name: string; age_category: string; capacity_role_name: string | null }

const AGE_LABEL: Record<string, string> = {
  adult: "Adult", junior_16: "Jr ≤16", junior_17: "Jr 17", junior_18: "Jr 18", junior_19: "Jr 19",
};

/** The award age bracket a DOB falls in (mirrors the backend). */
function ageCategoryFor(dob: string | null): string | null {
  if (!dob) return null;
  const b = dayjs(dob);
  let age = dayjs().diff(b, "year");
  if (dayjs().isBefore(b.add(age, "year"))) age--; // guard rounding
  if (age <= 16) return "junior_16";
  if (age === 17) return "junior_17";
  if (age === 18) return "junior_18";
  if (age === 19) return "junior_19";
  return "adult";
}

export function PersonRatesSection({ personId, dob }: { personId: number; dob: string | null }) {
  return (
    <Card withBorder>
      <Title order={4} mb="sm">Pay rates</Title>
      <Text size="sm" c="dimmed" mb="sm">
        Employees are paid by grade (per work type) at their basis; contractors get
        per-activity rates. Use whichever matches this person's engagement.
      </Text>
      <EmployeeGrades personId={personId} dob={dob} />
      <Divider my="md" label="Contractor rates" labelPosition="left" />
      <ContractorRates personId={personId} />
    </Card>
  );
}

function fmtRange(from: string, to: string | null) {
  return `from ${dayjs(from).format("D MMM YYYY")}${to ? ` to ${dayjs(to).format("D MMM YYYY")}` : ""}`;
}

function EmployeeGrades({ personId, dob }: { personId: number; dob: string | null }) {
  const qc = useQueryClient();
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [basis, setBasis] = useState("casual");
  const [from, setFrom] = useState<Date | null>(new Date());
  const [to, setTo] = useState<Date | null>(null);
  const [ack, setAck] = useState(false);
  const q = useQuery({ queryKey: ["person-grades", personId], queryFn: () => api.get<EmployeeGrade[]>(`/people/${personId}/grades`) });
  const gradesQ = useQuery({ queryKey: ["pay-grades"], queryFn: () => api.get<PayGrade[]>("/pay-grades") });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["person-grades", personId] });

  const expectedAge = ageCategoryFor(dob);
  const selected = (gradesQ.data ?? []).find((g) => String(g.id) === gradeId);
  const mismatch = !!(selected && expectedAge && selected.age_category !== expectedAge);

  const addM = useMutation({
    mutationFn: () => api.post(`/people/${personId}/grades`, {
      pay_grade_id: Number(gradeId), basis,
      from_date: dayjs(from).format("YYYY-MM-DD"), to_date: to ? dayjs(to).format("YYYY-MM-DD") : null,
    }),
    onSuccess: () => { invalidate(); setGradeId(null); setAck(false); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/people/${personId}/grades/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Employee grades</Text>
      {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">None.</Text>}
      {(q.data ?? []).map((e) => (
        <Group key={e.id} gap={8}>
          <Badge variant="light">{e.capacity_role_name}</Badge>
          <Text size="sm">
            {e.grade_name}{e.age_category ? ` (${AGE_LABEL[e.age_category] ?? e.age_category})` : ""} ·{" "}
            {BASES.find((b) => b.value === e.basis)?.label ?? e.basis}
          </Text>
          {expectedAge && e.age_category && e.age_category !== expectedAge && (
            <Badge size="xs" color="orange" variant="light">age ≠ DOB</Badge>
          )}
          <Text size="sm" c="dimmed">{fmtRange(e.from_date, e.to_date)}</Text>
          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delM.mutate(e.id)}><IconX size={12} /></ActionIcon>
        </Group>
      ))}
      <Group align="flex-end" gap="xs">
        <Select label="Grade" w={240} placeholder="Choose"
          data={(gradesQ.data ?? []).map((g) => ({
            value: String(g.id), label: `${g.capacity_role_name} · ${g.name} (${AGE_LABEL[g.age_category] ?? g.age_category})`,
          }))}
          value={gradeId} onChange={setGradeId} searchable comboboxProps={{ withinPortal: true }} />
        <Select label="Basis" w={120} data={BASES} value={basis} onChange={(v) => v && setBasis(v)} comboboxProps={{ withinPortal: true }} />
        <DateInput label="From" w={140} value={from} onChange={setFrom} valueFormat="D MMM YYYY" />
        <DateInput label="To" w={130} value={to} onChange={setTo} clearable valueFormat="D MMM YYYY" />
        <Button size="sm" variant="light" loading={addM.isPending}
          disabled={!gradeId || !from || (mismatch && !ack)} onClick={() => addM.mutate()}>Add</Button>
      </Group>
      {mismatch && (
        <Checkbox size="sm" checked={ack} onChange={(e) => setAck(e.currentTarget.checked)}
          label={`This grade is ${AGE_LABEL[selected!.age_category]}, but their date of birth suggests ${AGE_LABEL[expectedAge!]}. I've checked and want to place them here.`} />
      )}
    </Stack>
  );
}

function ContractorRates({ personId }: { personId: number }) {
  const qc = useQueryClient();
  const [activityId, setActivityId] = useState<string | null>(null);
  const [wd, setWd] = useState<number>(0);
  const [sat, setSat] = useState<number>(0);
  const [sun, setSun] = useState<number>(0);
  const [ph, setPh] = useState<number>(0);
  const [from, setFrom] = useState<Date | null>(new Date());
  const q = useQuery({ queryKey: ["contractor-rates", personId], queryFn: () => api.get<ContractorRate[]>(`/people/${personId}/contractor-rates`) });
  const activitiesQ = useQuery({ queryKey: ["activities"], queryFn: () => api.get<Activity[]>("/activities") });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["contractor-rates", personId] });

  const addM = useMutation({
    mutationFn: () => api.post(`/people/${personId}/contractor-rates`, {
      activity_id: Number(activityId),
      weekday_rate: wd, saturday_rate: sat, sunday_rate: sun, public_holiday_rate: ph,
      from_date: dayjs(from).format("YYYY-MM-DD"),
    }),
    onSuccess: () => { invalidate(); setActivityId(null); setWd(0); setSat(0); setSun(0); setPh(0); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/people/${personId}/contractor-rates/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Stack gap="xs">
      <Table striped withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Work type</Table.Th><Table.Th>Weekday</Table.Th><Table.Th>Sat</Table.Th>
            <Table.Th>Sun</Table.Th><Table.Th>Pub. hol.</Table.Th><Table.Th>Effective</Table.Th><Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).length === 0 && (
            <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" size="sm">None.</Text></Table.Td></Table.Tr>
          )}
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{r.activity_name}</Table.Td>
              <Table.Td>{money(r.weekday_rate)}</Table.Td>
              <Table.Td>{money(r.saturday_rate)}</Table.Td>
              <Table.Td>{money(r.sunday_rate)}</Table.Td>
              <Table.Td>{money(r.public_holiday_rate)}</Table.Td>
              <Table.Td>from {dayjs(r.from_date).format("D MMM YYYY")}</Table.Td>
              <Table.Td>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delM.mutate(r.id)}><IconX size={12} /></ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group align="flex-end" gap="xs">
        <Select label="Work type" w={180} placeholder="Activity"
          data={(activitiesQ.data ?? []).filter((a) => a.is_active).map((a) => ({ value: String(a.id), label: a.name }))}
          value={activityId} onChange={setActivityId} searchable comboboxProps={{ withinPortal: true }} />
        <NumberInput label="Weekday" w={90} min={0} step={0.5} value={wd} onChange={(v) => setWd(Number(v) || 0)} />
        <NumberInput label="Sat" w={80} min={0} step={0.5} value={sat} onChange={(v) => setSat(Number(v) || 0)} />
        <NumberInput label="Sun" w={80} min={0} step={0.5} value={sun} onChange={(v) => setSun(Number(v) || 0)} />
        <NumberInput label="Pub. hol." w={90} min={0} step={0.5} value={ph} onChange={(v) => setPh(Number(v) || 0)} />
        <DateInput label="Effective from" w={140} value={from} onChange={setFrom} valueFormat="D MMM YYYY" />
        <Button size="sm" variant="light" loading={addM.isPending} disabled={!activityId || !from} onClick={() => addM.mutate()}>Add</Button>
      </Group>
    </Stack>
  );
}
