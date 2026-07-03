import { Button, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { TimeField } from "./TimeField";
import { DateField } from "./DateField";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity, Role, Shift } from "../api/types";

function toDateTime(date: Date, time: string): string {
  return `${dayjs(date).format("YYYY-MM-DD")}T${time}:00`;
}

export function ShiftModal({
  shift,
  defaultDate,
  opened,
  onClose,
  canEdit,
}: {
  shift: Shift | null;
  defaultDate: Date;
  opened: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | null>(defaultDate);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [headcount, setHeadcount] = useState(1);
  const [notes, setNotes] = useState("");

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });

  useEffect(() => {
    if (!opened) return;
    setEditing(shift === null); // new shift opens straight into edit
    if (shift) {
      setActivityId(String(shift.activity_id));
      setRoleId(shift.role_id ? String(shift.role_id) : null);
      setDescription(shift.description ?? "");
      setDate(dayjs(shift.starts_at).toDate());
      setStart(dayjs(shift.starts_at).format("HH:mm"));
      setEnd(dayjs(shift.ends_at).format("HH:mm"));
      setHeadcount(shift.headcount);
      setNotes(shift.notes ?? "");
    } else {
      setActivityId(null);
      setRoleId(null);
      setDescription("");
      setDate(defaultDate);
      setStart("08:00");
      setEnd("12:00");
      setHeadcount(1);
      setNotes("");
    }
  }, [shift, opened, defaultDate]);

  const saveM = useMutation({
    mutationFn: () => {
      const body = {
        activity_id: Number(activityId),
        role_id: roleId ? Number(roleId) : null,
        description: description.trim() || null,
        starts_at: date ? toDateTime(date, start) : null,
        ends_at: date ? toDateTime(date, end) : null,
        headcount,
        notes: notes || null,
      };
      return shift ? api.patch(`/shifts/${shift.id}`, body) : api.post("/shifts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: () => api.del(`/shifts/${shift!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const activityOptions = (activitiesQ.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ value: String(a.id), label: a.name }));
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const ro = !editing;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnClickOutside={false}
      title={shift ? (editing ? "Edit shift" : "Shift") : "Add shift"}
    >
      <Stack>
        <TextInput
          label="Description"
          placeholder="Optional label (defaults to the activity name)"
          value={description}
          disabled={ro}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Activity"
          data={activityOptions}
          value={activityId}
          onChange={setActivityId}
          required
          disabled={ro}
          comboboxProps={{ withinPortal: true }}
        />
        <Select
          label="Required role"
          data={roleOptions}
          value={roleId}
          onChange={setRoleId}
          placeholder="Any"
          clearable
          disabled={ro}
          comboboxProps={{ withinPortal: true }}
        />
        <DateField label="Date" value={date} onChange={setDate} required disabled={ro} />
        <Group>
          <TimeField label="Start" value={start} onChange={setStart} disabled={ro} />
          <TimeField label="End" value={end} onChange={setEnd} disabled={ro} />
        </Group>
        <NumberInput
          label="People needed"
          min={1}
          value={headcount}
          disabled={ro}
          onChange={(v) => setHeadcount(Number(v) || 1)}
        />
        <Textarea
          label="Notes"
          value={notes}
          disabled={ro}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        {editing ? (
          <Group justify="space-between">
            {shift ? (
              <Button color="red" variant="light" loading={deleteM.isPending} onClick={() => deleteM.mutate()}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button loading={saveM.isPending} disabled={!activityId} onClick={() => saveM.mutate()}>
              Save
            </Button>
          </Group>
        ) : (
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Close</Button>
            {canEdit && <Button onClick={() => setEditing(true)}>Edit</Button>}
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
