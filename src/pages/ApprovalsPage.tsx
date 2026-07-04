import { Badge, Button, Card, Group, Loader, NumberInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";

interface PendingShift {
  shift_id: number;
  activity_name: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  created_by_name: string | null;
  attendance_id: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours_worked: number | null;
  notes: string | null;
}

export function ApprovalsPage() {
  const q = useQuery({
    queryKey: ["pending-approval"],
    queryFn: () => api.get<PendingShift[]>("/shifts/pending-approval"),
  });

  return (
    <Stack maw={780}>
      <Title order={2}>Approvals</Title>
      <Text size="sm" c="dimmed">
        Staff-logged extra tasks awaiting review. Approving counts the hours; rejecting
        discards the entry.
      </Text>
      {q.isLoading ? (
        <Loader />
      ) : (q.data ?? []).length === 0 ? (
        <Text c="dimmed">Nothing to review.</Text>
      ) : (
        (q.data ?? []).map((p) => <PendingRow key={p.shift_id} item={p} />)
      )}
    </Stack>
  );
}

function PendingRow({ item }: { item: PendingShift }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<number>(item.hours_worked ?? 0);
  const done = () => {
    qc.invalidateQueries({ queryKey: ["pending-approval"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };
  const approveM = useMutation({
    mutationFn: () => api.post(`/shifts/${item.shift_id}/approve`, { hours_worked: hours }),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const rejectM = useMutation({
    mutationFn: () => api.post(`/shifts/${item.shift_id}/reject`),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const notCheckedOut = !item.checked_out_at;
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Group gap="xs">
            <Text fw={600}>{item.title || item.activity_name || "Task"}</Text>
            {item.activity_name && <Badge variant="light">{item.activity_name}</Badge>}
            {notCheckedOut && <Badge color="orange" variant="light">Still on site</Badge>}
          </Group>
          <Text size="sm" c="dimmed">
            {item.created_by_name ?? "—"} ·{" "}
            {item.checked_in_at ? dayjs(item.checked_in_at).format("D MMM HH:mm") : "—"}
            {item.checked_out_at ? `–${dayjs(item.checked_out_at).format("HH:mm")}` : ""}
          </Text>
          {item.notes && <Text size="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>{item.notes}</Text>}
        </div>
        <Group gap="xs" align="flex-end">
          <NumberInput label="Hours" w={90} min={0} step={0.25} value={hours}
            onChange={(v) => setHours(Number(v) || 0)} />
          <Button color="teal" loading={approveM.isPending} disabled={notCheckedOut}
            onClick={() => approveM.mutate()}>
            Approve
          </Button>
          <Button variant="light" color="red" loading={rejectM.isPending} onClick={() => rejectM.mutate()}>
            Reject
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
