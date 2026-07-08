import {
  ActionIcon, Anchor, Badge, Button, Card, Group, Loader, Modal, NumberInput, Stack, Table, Text, Textarea, Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconCoin, IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getToken } from "../api/client";
import { useAuth } from "../auth/AuthContext";

async function downloadPayrollCsv(key: string) {
  const res = await fetch(`/api/reports/payroll/export?period_start=${key}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { notifications.show({ color: "red", message: "Export failed" }); return; }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = `payroll_${key}.csv`; a.click();
  URL.revokeObjectURL(url);
}

interface PayrollLine { capacity_role_name: string; hours: number; pay: number; unrated_hours: number; pending: boolean }
interface Adjustment { id: number; hours: number; pay: number | null; reason: string; capacity_role_name: string | null }
interface PayrollPerson {
  person_id: number; name: string; lines: PayrollLine[]; adjustments: Adjustment[];
  base_total: number; adjustment_total: number; total: number;
  base_pay: number; adjustment_pay: number; total_pay: number;
  has_pending: boolean; has_unrated: boolean; age_warning: boolean;
  kind: string; // employee | contractor | other
  super_pct: number; super_amount: number;
}
const GROUP_LABEL: Record<string, string> = {
  employee: "Employees (wages)", contractor: "Contractors (invoices)", other: "Other",
};
interface PayrollReport {
  period_start: string; period_end: string; closed: boolean; people: PayrollPerson[];
}
interface PayRun {
  period_start: string; period_end: string; approved_at: string; approved_by: string | null;
  person_count: number; total_pay: number;
}

interface OrgPeriod {
  pay_period_start_weekday: number;
  pay_period_frequency: string;
  pay_period_anchor: string | null;
}

/** period 0=Mon..6=Sun; align a date back to the most recent start weekday. */
function periodStartFor(today: Dayjs, weekday: number): Dayjs {
  const dowMon = (today.day() + 6) % 7;
  return today.subtract((dowMon - weekday + 7) % 7, "day").startOf("day");
}

/** The start of the period containing `ref`, honouring frequency. */
function periodStart(ref: Dayjs, org: OrgPeriod): Dayjs {
  if (org.pay_period_frequency === "monthly") return ref.startOf("month");
  if (org.pay_period_frequency === "fortnightly" && org.pay_period_anchor) {
    const anchor = dayjs(org.pay_period_anchor).startOf("day");
    const k = Math.floor(ref.startOf("day").diff(anchor, "day") / 14);
    return anchor.add(k * 14, "day");
  }
  return periodStartFor(ref, org.pay_period_start_weekday);
}

/** The last (inclusive) day of the period starting at `start`. */
function periodEndInclusive(start: Dayjs, org: OrgPeriod): Dayjs {
  if (org.pay_period_frequency === "monthly") return start.endOf("month").startOf("day");
  return start.add(org.pay_period_frequency === "fortnightly" ? 13 : 6, "day");
}

/** Step to the previous/next period. */
function stepPeriod(start: Dayjs, org: OrgPeriod, dir: 1 | -1): Dayjs {
  if (org.pay_period_frequency === "monthly") return start.add(dir, "month").startOf("month");
  return start.add(dir * (org.pay_period_frequency === "fortnightly" ? 14 : 7), "day");
}

const periodLabel = (start: Dayjs, org: OrgPeriod) =>
  `${start.format("D MMM")} – ${periodEndInclusive(start, org).format("D MMM YYYY")}`;

export function PayrollPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const orgQ = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<OrgPeriod>("/settings/org"),
  });
  const org = orgQ.data;
  const [period, setPeriod] = useState<Dayjs | null>(null); // null = show the runs list
  const [createOpen, setCreateOpen] = useState(false);
  const [createStart, setCreateStart] = useState<Dayjs | null>(null);

  const runsQ = useQuery({ queryKey: ["pay-runs"], queryFn: () => api.get<PayRun[]>("/reports/payroll/runs") });

  // RUN-2: default a new run to the most-recent *completed* period, not "this week".
  function openCreate() {
    setCreateStart(stepPeriod(periodStart(dayjs(), org!), org!, -1));
    setCreateOpen(true);
  }

  return (
    <Stack maw={860} w="100%" mx="auto">
      <Group justify="space-between">
        <Title order={2}>Payroll</Title>
        {can("manage_pay_rates") && (
          <Button variant="light" leftSection={<IconCoin size={16} />} onClick={() => navigate("/payroll/rates")}>
            Pay rates
          </Button>
        )}
      </Group>

      {period && org ? (
        <PeriodReport
          start={period}
          org={org}
          onBack={() => setPeriod(null)}
          onSetStart={setPeriod}
        />
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">Approved pay runs. Create one, review it, then approve.</Text>
            <Button leftSection={<IconPlus size={16} />} disabled={!orgQ.data} onClick={openCreate}>
              Create pay run
            </Button>
          </Group>
          {runsQ.isLoading ? (
            <Loader />
          ) : (runsQ.data ?? []).length === 0 ? (
            <Card withBorder><Text c="dimmed">No pay runs yet. Create one to get started.</Text></Card>
          ) : (
            <Card withBorder p={0}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Period</Table.Th><Table.Th>People</Table.Th>
                    <Table.Th>Total</Table.Th><Table.Th>Approved</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(runsQ.data ?? []).map((r) => (
                    <Table.Tr key={r.period_start} style={{ cursor: "pointer" }}
                      onClick={() => setPeriod(dayjs(r.period_start))}>
                      <Table.Td>
                        {dayjs(r.period_start).format("D MMM")} – {dayjs(r.period_end).subtract(1, "day").format("D MMM YYYY")}
                      </Table.Td>
                      <Table.Td>{r.person_count}</Table.Td>
                      <Table.Td>${r.total_pay.toFixed(2)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {dayjs(r.approved_at).format("D MMM YYYY")}{r.approved_by ? ` · ${r.approved_by}` : ""}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Stack>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New pay run">
        <Stack>
          <Text size="sm" c="dimmed">Which period are you paying? Defaults to the last completed period.</Text>
          {createStart && org && (
            <Group justify="center" gap="md">
              <ActionIcon variant="light" aria-label="Earlier period"
                onClick={() => setCreateStart((s) => stepPeriod(s!, org, -1))}>
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text fw={600}>{periodLabel(createStart, org)}</Text>
              <ActionIcon variant="light" aria-label="Later period"
                onClick={() => setCreateStart((s) => stepPeriod(s!, org, 1))}>
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => { setPeriod(createStart); setCreateOpen(false); }}>Open run</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function PeriodReport({ start, org, onBack, onSetStart }: {
  start: Dayjs; org: OrgPeriod; onBack: () => void; onSetStart: (d: Dayjs) => void;
}) {
  const qc = useQueryClient();
  const key = start.format("YYYY-MM-DD");
  const reportQ = useQuery({
    queryKey: ["payroll", key],
    queryFn: () => api.get<PayrollReport>(`/reports/payroll?period_start=${key}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payroll"] });
    qc.invalidateQueries({ queryKey: ["pay-runs"] });
  };
  const closeM = useMutation({
    mutationFn: (close: boolean) => api.post(`/reports/payroll/${close ? "close" : "reopen"}`, { period_start: key }),
    onSuccess: (_d, close) => { refresh(); if (close) onBack(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const report = reportQ.data;

  return (
    <Stack>
      <Group justify="space-between">
        <Button variant="subtle" size="xs" onClick={onBack}>← Back to pay runs</Button>
        <Group gap="xs">
          {report && report.people.length > 0 && (
            <Button size="xs" variant="light" onClick={() => downloadPayrollCsv(key)}>Export CSV</Button>
          )}
          {report && (
            report.closed
              ? <Button size="xs" variant="default" color="gray" loading={closeM.isPending}
                  onClick={() => closeM.mutate(false)}>Reopen (unapprove)</Button>
              : <Button size="xs" color="blue" loading={closeM.isPending} disabled={report.people.length === 0}
                  onClick={() => closeM.mutate(true)}>Approve pay run</Button>
          )}
        </Group>
      </Group>
      <Group gap="xs">
        <ActionIcon variant="light" onClick={() => onSetStart(stepPeriod(start, org, -1))}>
          <IconChevronLeft size={16} />
        </ActionIcon>
        <Text fw={600}>{periodLabel(start, org)}</Text>
        <ActionIcon variant="light" onClick={() => onSetStart(stepPeriod(start, org, 1))}>
          <IconChevronRight size={16} />
        </ActionIcon>
        {report?.closed && <Badge color="blue">Approved</Badge>}
      </Group>

      {reportQ.isLoading || !report ? (
        <Loader />
      ) : report.people.length === 0 ? (
        <Text c="dimmed">No hours recorded this period.</Text>
      ) : (
        <>
          {["employee", "contractor", "other"].map((kind) => {
            const group = report.people.filter((p) => p.kind === kind);
            if (group.length === 0) return null;
            const hrs = group.reduce((s, p) => s + p.total, 0);
            const pay = group.reduce((s, p) => s + p.total_pay, 0);
            const sup = group.reduce((s, p) => s + p.super_amount, 0);
            return (
              <Stack key={kind} gap="xs">
                <Text fw={700} tt="uppercase" size="xs" c="dimmed" mt="sm" style={{ letterSpacing: 0.6 }}>
                  {GROUP_LABEL[kind]}
                </Text>
                {group.map((p) => (
                  <PayrollRow key={p.person_id} person={p} periodStart={key} closed={report.closed} />
                ))}
                <Group justify="space-between" px="sm" py={4}
                  style={{ borderTop: "2px solid var(--mantine-color-default-border)" }}>
                  <Text size="sm" fw={600}>{GROUP_LABEL[kind]} subtotal</Text>
                  <Text size="sm" fw={600}>
                    {hrs.toFixed(2)}h · ${pay.toFixed(2)}
                    {sup > 0 && <Text span size="xs" c="dimmed"> · +${sup.toFixed(2)} super</Text>}
                  </Text>
                </Group>
              </Stack>
            );
          })}
          <Group justify="space-between" px="sm" py={6}
            style={{ borderTop: "2px solid var(--mantine-color-default-border)" }}>
            <Text fw={700}>Run total</Text>
            <Text fw={700}>
              {report.people.reduce((s, p) => s + p.total, 0).toFixed(2)}h ·{" "}
              ${report.people.reduce((s, p) => s + p.total_pay, 0).toFixed(2)}
            </Text>
          </Group>
        </>
      )}
    </Stack>
  );
}

function PayrollRow({ person, periodStart, closed }: { person: PayrollPerson; periodStart: string; closed: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<number>(0);
  const [reason, setReason] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["payroll"] });
  const addM = useMutation({
    mutationFn: () =>
      api.post("/reports/adjustments", {
        person_id: person.person_id, period_start: periodStart, hours, reason: reason.trim(),
      }),
    onSuccess: () => { setOpen(false); setHours(0); setReason(""); refresh(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/reports/adjustments/${id}`),
    onSuccess: refresh,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs">
            <Anchor component={Link} to={`/people/${person.person_id}`} fw={600}>{person.name}</Anchor>
            {person.has_pending && <Badge color="yellow" variant="light">has pending</Badge>}
            {person.has_unrated && <Badge color="red" variant="light">unrated hours</Badge>}
            {person.age_warning && <Badge color="orange" variant="light">age bracket?</Badge>}
          </Group>
          <Stack gap={2} mt={4}>
            {person.lines.map((l, i) => (
              <Text key={i} size="sm" c="dimmed">
                {l.capacity_role_name}: <b>{l.hours}h</b>
                {l.unrated_hours > 0 ? " · no rate set" : ` · $${l.pay.toFixed(2)}`}
                {l.pending ? " (pending)" : ""}
              </Text>
            ))}
            {person.has_unrated && (
              <Anchor component={Link} to={`/people/${person.person_id}`} size="xs">
                Assign a pay grade →
              </Anchor>
            )}
            {person.adjustments.map((a) => (
              <Group key={a.id} gap={6}>
                <Text size="sm" c={a.hours < 0 ? "red" : "teal"}>
                  Adjustment: {a.hours > 0 ? "+" : ""}{a.hours}h — {a.reason}
                </Text>
                {!closed && (
                  <ActionIcon size="xs" color="red" variant="subtle" onClick={() => delM.mutate(a.id)}>
                    <IconX size={12} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>
        </div>
        <div style={{ textAlign: "right" }}>
          <Text fw={700} fz="xl">${person.total_pay.toFixed(2)}</Text>
          <Text size="sm" c="dimmed">{person.total}h</Text>
          {person.super_amount > 0 && (
            <Text size="xs" c="dimmed">+ ${person.super_amount.toFixed(2)} super ({person.super_pct}%)</Text>
          )}
          {person.adjustment_total !== 0 && (
            <Text size="xs" c="dimmed">{person.base_total}h base {person.adjustment_total > 0 ? "+" : ""}{person.adjustment_total}h adj</Text>
          )}
          {!closed && (
            <Button size="xs" variant="subtle" mt={4} onClick={() => setOpen(true)}>Adjust</Button>
          )}
        </div>
      </Group>

      <Modal opened={open} onClose={() => setOpen(false)} title={`Adjust ${person.name}`}>
        <Stack>
          <Text size="sm" c="dimmed">A +/- correction for this period. Requires a reason.</Text>
          <NumberInput label="Hours (+/-)" step={0.25} value={hours} onChange={(v) => setHours(Number(v) || 0)} />
          <Textarea label="Reason" value={reason} autosize minRows={2}
            onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={addM.isPending} disabled={!reason.trim() || hours === 0}
              onClick={() => addM.mutate()}>Add adjustment</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
