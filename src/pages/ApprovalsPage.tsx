import { Badge, Button, Card, Group, Loader, Modal, NumberInput, SegmentedControl, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Activity, Person } from "../api/types";

interface PendingShift {
  shift_id: number;
  activity_id: number;
  activity_name: string | null;
  is_lesson: boolean;
  title: string | null;
  starts_at: string;
  ends_at: string;
  created_by_name: string | null;
  attendance_id: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  claimed_hours: number | null;
  notes: string | null;
}

interface Variance {
  attendance_id: number;
  person_name: string | null;
  shift_title: string | null;
  activity_name: string | null;
  starts_at: string | null;
  planned_hours: number | null;
  claimed_hours: number | null;
  reason: string | null;
}

interface NoShow {
  shift_id: number;
  title: string | null;
  activity_name: string | null;
  starts_at: string;
  person_id: number;
  person_name: string | null;
}
interface OpenAtt {
  attendance_id: number;
  person_id: number;
  person_name: string | null;
  shift_id: number | null;
  shift_title: string | null;
  checked_in_at: string;
  planned_hours: number | null;
}

interface CoachChange {
  id: number;
  shift_id: number;
  lesson_title: string | null;
  activity_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  from_coach_name: string | null;
  to_coach_name: string | null;
  reason: string;
}

export function ApprovalsPage() {
  const q = useQuery({
    queryKey: ["pending-approval"],
    queryFn: () => api.get<PendingShift[]>("/shifts/pending-approval"),
  });
  const ccQ = useQuery({
    queryKey: ["coach-changes"],
    queryFn: () => api.get<CoachChange[]>("/coach-changes/pending"),
  });
  const varQ = useQuery({
    queryKey: ["variance"],
    queryFn: () => api.get<Variance[]>("/variance/pending"),
  });
  const nsQ = useQuery({
    queryKey: ["no-shows"],
    queryFn: () => api.get<NoShow[]>("/shifts/no-shows"),
    refetchInterval: 60000,
  });
  const openQ = useQuery({
    queryKey: ["open-attendance"],
    queryFn: () => api.get<OpenAtt[]>("/attendance/open"),
    refetchInterval: 60000,
  });

  return (
    <Stack maw={780} w="100%" mx="auto">
      <Title order={2}>Approvals & attention</Title>

      {(nsQ.data ?? []).length > 0 && (
        <>
          <Title order={4} mt="sm" c="orange">No-shows</Title>
          <Text size="sm" c="dimmed">
            Assigned to a started shift but not checked in. Mark them present if they're here.
          </Text>
          {(nsQ.data ?? []).map((n) => <NoShowRow key={`${n.shift_id}-${n.person_id}`} item={n} />)}
        </>
      )}

      {(openQ.data ?? []).length > 0 && (
        <>
          <Title order={4} mt="lg">Still checked in</Title>
          <Text size="sm" c="dimmed">People who haven't checked out. Close it off for them.</Text>
          {(openQ.data ?? []).map((o) => <OpenAttRow key={o.attendance_id} item={o} />)}
        </>
      )}

      <Title order={4} mt="lg">Extra tasks</Title>
      <Text size="sm" c="dimmed">
        Staff-logged extra tasks awaiting review. For a lesson, confirm (or change) the
        lesson type; otherwise the hours. The person is emailed the outcome.
      </Text>
      {q.isLoading ? (
        <Loader />
      ) : (q.data ?? []).length === 0 ? (
        <Text c="dimmed">Nothing to review.</Text>
      ) : (
        (q.data ?? []).map((p) => <PendingRow key={p.shift_id} item={p} />)
      )}

      <Title order={4} mt="lg">Hours variance</Title>
      <Text size="sm" c="dimmed">
        Check-outs where the claimed hours differ from planned beyond the activity's
        margin. Approve (adjust if needed) or reject to the planned hours.
      </Text>
      {varQ.isLoading ? (
        <Loader />
      ) : (varQ.data ?? []).length === 0 ? (
        <Text c="dimmed">Nothing to review.</Text>
      ) : (
        (varQ.data ?? []).map((v) => <VarianceRow key={v.attendance_id} item={v} />)
      )}

      <Title order={4} mt="lg">Coach cover</Title>
      <Text size="sm" c="dimmed">
        A coach took over another coach's lesson. Approve the change, or reject it and
        cancel the lesson, revert it to the original coach, or reassign it.
      </Text>
      {ccQ.isLoading ? (
        <Loader />
      ) : (ccQ.data ?? []).length === 0 ? (
        <Text c="dimmed">Nothing to review.</Text>
      ) : (
        (ccQ.data ?? []).map((cc) => <CoachChangeRow key={cc.id} item={cc} />)
      )}
    </Stack>
  );
}

function PendingRow({ item }: { item: PendingShift }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<number>(item.claimed_hours ?? 0);
  const [lessonType, setLessonType] = useState<string>(String(item.activity_id));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
    enabled: item.is_lesson,
  });
  const lessonOptions = (activitiesQ.data ?? [])
    .filter((a) => a.is_lesson && a.is_active)
    .map((a) => ({ value: String(a.id), label: a.name }));
  const done = () => {
    qc.invalidateQueries({ queryKey: ["pending-approval"] });
    qc.invalidateQueries({ queryKey: ["pending-approval-count"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };
  const approveM = useMutation({
    mutationFn: () =>
      api.post(`/shifts/${item.shift_id}/approve`, item.is_lesson
        ? { activity_id: Number(lessonType) }
        : { claimed_hours: hours }),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const rejectM = useMutation({
    mutationFn: () => api.post(`/shifts/${item.shift_id}/reject`, { reason: reason.trim() }),
    onSuccess: () => { setRejectOpen(false); done(); },
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
          {item.is_lesson ? (
            <Select label="Lesson type" w={160} data={lessonOptions} value={lessonType}
              onChange={(v) => v && setLessonType(v)} comboboxProps={{ withinPortal: true }} />
          ) : (
            <NumberInput label="Hours" w={90} min={0} step={0.25} value={hours}
              onChange={(v) => setHours(Number(v) || 0)} />
          )}
          <Button color="teal" loading={approveM.isPending} disabled={notCheckedOut}
            onClick={() => approveM.mutate()}>
            Approve
          </Button>
          <Button variant="light" color="red" onClick={() => { setReason(""); setRejectOpen(true); }}>
            Reject
          </Button>
        </Group>
      </Group>

      <Modal opened={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject request">
        <Stack>
          <Text size="sm" c="dimmed">
            The person will be emailed this reason. Required.
          </Text>
          <Textarea label="Reason" value={reason} autosize minRows={2}
            onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button color="red" loading={rejectM.isPending} disabled={!reason.trim()}
              onClick={() => rejectM.mutate()}>
              Reject
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

function CoachChangeRow({ item }: { item: CoachChange }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"cancel" | "revert" | "reassign">("revert");
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const peopleQ = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<Person[]>("/people"),
    enabled: open,
  });
  const coachOptions = (peopleQ.data ?? [])
    .filter((p) => p.is_active && p.roles.some((r) => r.slug === "coach"))
    .map((p) => ({ value: String(p.id), label: p.full_name }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["coach-changes"] });
    qc.invalidateQueries({ queryKey: ["coach-changes-count"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };
  const approveM = useMutation({
    mutationFn: () => api.post(`/coach-changes/${item.id}/approve`),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const resolveM = useMutation({
    mutationFn: () =>
      api.post(`/coach-changes/${item.id}/resolve`, {
        action,
        reassign_to_person_id: action === "reassign" && reassignTo ? Number(reassignTo) : null,
        note: note.trim(),
      }),
    onSuccess: () => { setOpen(false); done(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Group gap="xs">
            <Text fw={600}>{item.lesson_title || item.activity_name || "Lesson"}</Text>
            {item.activity_name && <Badge variant="light">{item.activity_name}</Badge>}
          </Group>
          <Text size="sm" c="dimmed">
            {item.starts_at ? dayjs(item.starts_at).format("D MMM HH:mm") : "—"} ·{" "}
            {item.from_coach_name ?? "—"} → <b>{item.to_coach_name ?? "—"}</b>
          </Text>
          <Text size="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>{item.reason}</Text>
        </div>
        <Group gap="xs">
          <Button color="teal" loading={approveM.isPending} onClick={() => approveM.mutate()}>
            Approve
          </Button>
          <Button variant="light" color="red" onClick={() => { setNote(""); setOpen(true); }}>
            Reject
          </Button>
        </Group>
      </Group>

      <Modal opened={open} onClose={() => setOpen(false)} title="Reject coach change">
        <Stack>
          <SegmentedControl
            fullWidth
            value={action}
            onChange={(v) => setAction(v as "cancel" | "revert" | "reassign")}
            data={[
              { label: "Revert to original", value: "revert" },
              { label: "Reassign", value: "reassign" },
              { label: "Cancel lesson", value: "cancel" },
            ]}
          />
          {action === "reassign" && (
            <Select label="Reassign to" placeholder="Choose a coach" searchable
              data={coachOptions} value={reassignTo} onChange={setReassignTo} />
          )}
          <Textarea label="Note (emailed to the covering coach)" value={note} autosize minRows={2}
            onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>Cancel</Button>
            <Button color="red" loading={resolveM.isPending}
              disabled={!note.trim() || (action === "reassign" && !reassignTo)}
              onClick={() => resolveM.mutate()}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

function VarianceRow({ item }: { item: Variance }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<number>(item.claimed_hours ?? 0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const done = () => {
    qc.invalidateQueries({ queryKey: ["variance"] });
    qc.invalidateQueries({ queryKey: ["variance-count"] });
  };
  const approveM = useMutation({
    mutationFn: () => api.post(`/variance/${item.attendance_id}/approve`, { approved_hours: hours }),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const rejectM = useMutation({
    mutationFn: () => api.post(`/variance/${item.attendance_id}/reject`, { note: note.trim() }),
    onSuccess: () => { setRejectOpen(false); done(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Group gap="xs">
            <Text fw={600}>{item.shift_title || item.activity_name || "Shift"}</Text>
            {item.activity_name && <Badge variant="light">{item.activity_name}</Badge>}
          </Group>
          <Text size="sm" c="dimmed">
            {item.person_name ?? "—"} ·{" "}
            {item.starts_at ? dayjs(item.starts_at).format("D MMM HH:mm") : "—"} · planned{" "}
            {item.planned_hours ?? "—"}h, claimed <b>{item.claimed_hours ?? "—"}h</b>
          </Text>
          {item.reason && <Text size="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>{item.reason}</Text>}
        </div>
        <Group gap="xs" align="flex-end">
          <NumberInput label="Approve hours" w={110} min={0} step={0.25} value={hours}
            onChange={(v) => setHours(Number(v) || 0)} />
          <Button color="teal" loading={approveM.isPending} onClick={() => approveM.mutate()}>
            Approve
          </Button>
          <Button variant="light" color="red" onClick={() => { setNote(""); setRejectOpen(true); }}>
            Reject
          </Button>
        </Group>
      </Group>

      <Modal opened={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject claim">
        <Stack>
          <Text size="sm" c="dimmed">
            The planned {item.planned_hours ?? 0}h will apply. The person is emailed this note.
          </Text>
          <Textarea label="Note" value={note} autosize minRows={2}
            onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button color="red" loading={rejectM.isPending} disabled={!note.trim()}
              onClick={() => rejectM.mutate()}>
              Reject
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

function NoShowRow({ item }: { item: NoShow }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.post(`/shifts/${item.shift_id}/manager-check-in`, { person_id: item.person_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["no-shows"] });
      qc.invalidateQueries({ queryKey: ["open-attendance"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600}>{item.person_name ?? "—"}</Text>
          <Text size="sm" c="dimmed">
            {item.title || item.activity_name || "Shift"} · {dayjs(item.starts_at).format("D MMM HH:mm")}
          </Text>
        </div>
        <Button size="sm" variant="light" loading={m.isPending} onClick={() => m.mutate()}>
          Mark present
        </Button>
      </Group>
    </Card>
  );
}

function OpenAttRow({ item }: { item: OpenAtt }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<number>(item.planned_hours ?? 0);
  const m = useMutation({
    mutationFn: () =>
      api.post(`/attendance/${item.attendance_id}/manager-check-out`, {
        claimed_hours: item.shift_id ? hours : null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["open-attendance"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600}>{item.person_name ?? "—"}</Text>
          <Text size="sm" c="dimmed">
            {item.shift_title ?? (item.shift_id ? "Shift" : "Coaching")} · in{" "}
            {dayjs(item.checked_in_at).format("HH:mm")}
          </Text>
        </div>
        <Group gap="xs" align="flex-end">
          {item.shift_id && (
            <NumberInput label="Hours" w={90} min={0} step={0.25} value={hours}
              onChange={(v) => setHours(Number(v) || 0)} />
          )}
          <Button size="sm" variant="light" color="orange" loading={m.isPending} onClick={() => m.mutate()}>
            Check out
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
