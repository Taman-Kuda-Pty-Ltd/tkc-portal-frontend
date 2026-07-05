import {
  ActionIcon, Badge, Button, Card, Group, Loader, Modal, NumberInput, Stack, Text, Textarea, Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface PayrollLine { capacity_role_name: string; hours: number; pay: number; unrated_hours: number; pending: boolean }
interface Adjustment { id: number; hours: number; pay: number | null; reason: string; capacity_role_name: string | null }
interface PayrollPerson {
  person_id: number; name: string; lines: PayrollLine[]; adjustments: Adjustment[];
  base_total: number; adjustment_total: number; total: number;
  base_pay: number; adjustment_pay: number; total_pay: number;
  has_pending: boolean; has_unrated: boolean;
}
interface PayrollReport {
  period_start: string; period_end: string; closed: boolean; people: PayrollPerson[];
}

/** period 0=Mon..6=Sun; align today to the most recent start weekday. */
function periodStartFor(today: Dayjs, weekday: number): Dayjs {
  const dowMon = (today.day() + 6) % 7;
  return today.subtract((dowMon - weekday + 7) % 7, "day").startOf("day");
}

export function PayrollPage() {
  const qc = useQueryClient();
  const orgQ = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<{ pay_period_start_weekday: number; pay_period_days: number }>("/settings/org"),
  });
  const [start, setStart] = useState<Dayjs | null>(null);
  useEffect(() => {
    if (orgQ.data && !start) setStart(periodStartFor(dayjs(), orgQ.data.pay_period_start_weekday));
  }, [orgQ.data, start]);
  const days = orgQ.data?.pay_period_days ?? 7;

  const key = start?.format("YYYY-MM-DD");
  const reportQ = useQuery({
    queryKey: ["payroll", key],
    queryFn: () => api.get<PayrollReport>(`/reports/payroll?period_start=${key}`),
    enabled: !!key,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["payroll"] });
  const closeM = useMutation({
    mutationFn: (close: boolean) =>
      api.post(`/reports/payroll/${close ? "close" : "reopen"}`, { period_start: key }),
    onSuccess: refresh,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const report = reportQ.data;
  return (
    <Stack maw={820} w="100%" mx="auto">
      <Title order={2}>Payroll</Title>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="light" onClick={() => start && setStart(start.subtract(days, "day"))}>
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text fw={600}>
            {start ? `${start.format("D MMM")} – ${start.add(days - 1, "day").format("D MMM YYYY")}` : "…"}
          </Text>
          <ActionIcon variant="light" onClick={() => start && setStart(start.add(days, "day"))}>
            <IconChevronRight size={16} />
          </ActionIcon>
          {report?.closed && <Badge color="blue">Closed</Badge>}
        </Group>
        {report && (
          <Button size="xs" variant={report.closed ? "default" : "light"}
            color={report.closed ? "gray" : "blue"} loading={closeM.isPending}
            onClick={() => closeM.mutate(!report.closed)}>
            {report.closed ? "Reopen period" : "Close period"}
          </Button>
        )}
      </Group>

      {reportQ.isLoading || !report ? (
        <Loader />
      ) : report.people.length === 0 ? (
        <Text c="dimmed">No hours recorded this period.</Text>
      ) : (
        report.people.map((p) => (
          <PayrollRow key={p.person_id} person={p} periodStart={key!} closed={report.closed} />
        ))
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
            <Text fw={600}>{person.name}</Text>
            {person.has_pending && <Badge color="yellow" variant="light">has pending</Badge>}
            {person.has_unrated && <Badge color="red" variant="light">unrated hours</Badge>}
          </Group>
          <Stack gap={2} mt={4}>
            {person.lines.map((l, i) => (
              <Text key={i} size="sm" c="dimmed">
                {l.capacity_role_name}: <b>{l.hours}h</b>
                {l.unrated_hours > 0 ? " · no rate set" : ` · $${l.pay.toFixed(2)}`}
                {l.pending ? " (pending)" : ""}
              </Text>
            ))}
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
