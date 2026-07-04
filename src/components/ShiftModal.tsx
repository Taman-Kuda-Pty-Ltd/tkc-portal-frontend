import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { TimeField } from "./TimeField";
import { DateField } from "./DateField";
import { RichTextField, RichTextView } from "./RichText";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity, Clash, NamedResource, Role, Shift, ShiftNote } from "../api/types";

interface RideDraft {
  student_id: string | null;
  horse_id: string | null;
}

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
  const [abbreviation, setAbbreviation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | null>(defaultDate);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [headcount, setHeadcount] = useState(1);
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [headingCounts, setHeadingCounts] = useState<Record<number, number>>({});
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [rides, setRides] = useState<RideDraft[]>([]);

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: () => api.get<NamedResource[]>("/facilities") });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => api.get<NamedResource[]>("/students") });
  const horsesQ = useQuery({ queryKey: ["horses"], queryFn: () => api.get<NamedResource[]>("/horses") });

  useEffect(() => {
    if (!opened) return;
    setEditing(shift === null); // new shift opens straight into edit
    setNewNote("");
    if (shift) {
      setActivityId(String(shift.activity_id));
      setRoleId(shift.role_id ? String(shift.role_id) : null);
      setAbbreviation(shift.abbreviation ?? "");
      setTitle(shift.title ?? "");
      setDescription(shift.description ?? "");
      setDate(dayjs(shift.starts_at).toDate());
      setStart(dayjs(shift.starts_at).format("HH:mm"));
      setEnd(dayjs(shift.ends_at).format("HH:mm"));
      setHeadcount(shift.headcount);
      setNotes(shift.notes);
      setHeadingCounts(Object.fromEntries(shift.heading_counts.map((c) => [c.heading_id, c.count])));
      setFacilityId(shift.facility_id ? String(shift.facility_id) : null);
      setRides(shift.rides.map((r) => ({
        student_id: String(r.student_id),
        horse_id: r.horse_id ? String(r.horse_id) : null,
      })));
    } else {
      setActivityId(null);
      setRoleId(null);
      setAbbreviation("");
      setTitle("");
      setDescription("");
      setDate(defaultDate);
      setStart("08:00");
      setEnd("12:00");
      setHeadcount(1);
      setNotes([]);
      setHeadingCounts({});
      setFacilityId(null);
      setRides([]);
    }
  }, [shift, opened, defaultDate]);

  const selectedActivity = (activitiesQ.data ?? []).find((a) => a.id === Number(activityId));
  const headings = (selectedActivity?.headings ?? []).filter((h) => h.is_active);
  const isLesson = !!selectedActivity?.is_lesson;
  const horseIds = rides.map((r) => r.horse_id).filter(Boolean).map(Number);

  const clashQ = useQuery({
    queryKey: ["clash", shift?.id, facilityId, horseIds.join(","), date ? dayjs(date).format("YYYY-MM-DD") : "", start, end],
    queryFn: () =>
      api.post<Clash[]>("/shifts/clash-check", {
        shift_id: shift?.id ?? null,
        starts_at: date ? toDateTime(date, start) : null,
        ends_at: date ? toDateTime(date, end) : null,
        facility_id: facilityId ? Number(facilityId) : null,
        horse_ids: horseIds,
      }),
    enabled: editing && isLesson && !!date && (!!facilityId || horseIds.length > 0),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const body = {
        activity_id: Number(activityId),
        role_id: roleId ? Number(roleId) : null,
        abbreviation: abbreviation.trim() || null,
        title: title.trim() || null,
        description: description.trim() || null,
        starts_at: date ? toDateTime(date, start) : null,
        ends_at: date ? toDateTime(date, end) : null,
        headcount,
        facility_id: isLesson && facilityId ? Number(facilityId) : null,
      };
      const saved = shift
        ? await api.patch<Shift>(`/shifts/${shift.id}`, body)
        : await api.post<Shift>("/shifts", body);
      if (headings.length) {
        await api.put(
          `/shifts/${saved.id}/heading-counts`,
          headings.map((h) => ({ heading_id: h.id, count: headingCounts[h.id] ?? h.count })),
        );
      }
      if (isLesson) {
        await api.put(
          `/shifts/${saved.id}/rides`,
          rides
            .filter((r) => r.student_id)
            .map((r) => ({ student_id: Number(r.student_id), horse_id: r.horse_id ? Number(r.horse_id) : null })),
        );
      }
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

  const addNoteM = useMutation({
    mutationFn: () => api.post<ShiftNote>(`/shifts/${shift!.id}/notes`, { body: newNote.trim() }),
    onSuccess: (n) => {
      setNotes((prev) => [...prev, n]);
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const delNoteM = useMutation({
    mutationFn: (noteId: number) => api.del(`/shifts/${shift!.id}/notes/${noteId}`),
    onSuccess: (_d, noteId) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const activityOptions = (activitiesQ.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ value: String(a.id), label: a.name }));
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const facilityOptions = (facilitiesQ.data ?? []).filter((f) => f.is_active).map((f) => ({ value: String(f.id), label: f.name }));
  const studentOptions = (studentsQ.data ?? []).filter((s) => s.is_active).map((s) => ({ value: String(s.id), label: s.name }));
  const horseOptions = (horsesQ.data ?? []).filter((h) => h.is_active).map((h) => ({ value: String(h.id), label: h.name }));
  const updateRide = (i: number, patch: Partial<RideDraft>) =>
    setRides(rides.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const ro = !editing;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnClickOutside={false}
      title={shift ? (editing ? "Edit shift" : "Shift") : "Add shift"}
    >
      <Stack>
        <TextInput label="Title" placeholder="Short label (defaults to the activity name)"
          value={title} disabled={ro} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextInput label="Abbreviation" placeholder="For compact views, e.g. AM" maxLength={10}
          value={abbreviation} disabled={ro} onChange={(e) => setAbbreviation(e.currentTarget.value)} />
        <Select label="Activity" data={activityOptions} value={activityId} onChange={setActivityId}
          required disabled={ro} comboboxProps={{ withinPortal: true }} />
        <Select label="Required role" data={roleOptions} value={roleId} onChange={setRoleId}
          placeholder="Any" clearable disabled={ro} comboboxProps={{ withinPortal: true }} />
        <DateField label="Date" value={date} onChange={setDate} required disabled={ro} />
        <Group>
          <TimeField label="Start" value={start} onChange={setStart} disabled={ro} />
          <TimeField label="End" value={end} onChange={setEnd} disabled={ro} />
        </Group>
        <RichTextField label="Description" placeholder="Longer detail shown in the day view"
          value={description} disabled={ro} onChange={setDescription} />

        {editing && headings.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb={4}>Required (per role)</Text>
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {headings.map((h) => (
                <NumberInput
                  key={h.id}
                  label={h.label}
                  min={0}
                  value={headingCounts[h.id] ?? h.count}
                  onChange={(v) => setHeadingCounts({ ...headingCounts, [h.id]: Number(v) || 0 })}
                />
              ))}
            </SimpleGrid>
          </div>
        )}

        {isLesson && (
          <>
            <Divider label="Lesson" labelPosition="left" />
            <Select label="Facility" data={facilityOptions} value={facilityId} onChange={setFacilityId}
              placeholder="Choose a facility" clearable disabled={ro} comboboxProps={{ withinPortal: true }} />
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>Riders</Text>
                {!ro && (
                  <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                    onClick={() => setRides([...rides, { student_id: null, horse_id: null }])}>
                    Add rider
                  </Button>
                )}
              </Group>
              <Stack gap="xs">
                {rides.length === 0 && <Text size="sm" c="dimmed">No riders yet.</Text>}
                {rides.map((r, i) => (
                  <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
                    <Select placeholder="Student" data={studentOptions} value={r.student_id} disabled={ro}
                      searchable style={{ flex: 1 }} onChange={(v) => updateRide(i, { student_id: v })}
                      comboboxProps={{ withinPortal: true }} />
                    <Text c="dimmed" pb={8}>on</Text>
                    <Select placeholder="Horse" data={horseOptions} value={r.horse_id} disabled={ro}
                      searchable clearable style={{ flex: 1 }} onChange={(v) => updateRide(i, { horse_id: v })}
                      comboboxProps={{ withinPortal: true }} />
                    {!ro && (
                      <ActionIcon color="red" variant="subtle" aria-label="Remove rider"
                        onClick={() => setRides(rides.filter((_, idx) => idx !== i))}>
                        <IconX size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
            </div>
            {editing && (clashQ.data?.length ?? 0) > 0 && (
              <Alert color="yellow" title="Possible double-booking">
                <Stack gap={2}>
                  {clashQ.data!.map((cl, i) => (
                    <Text key={i} size="sm">
                      {cl.name} ({cl.kind}) is also in “{cl.shift_label}”{" "}
                      {dayjs(cl.starts_at).format("HH:mm")}–{dayjs(cl.ends_at).format("HH:mm")}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}
          </>
        )}

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

        {shift && (
          <>
            <Divider label="Notes" labelPosition="left" />
            <Stack gap="xs">
              {notes.length === 0 && <Text size="sm" c="dimmed">No notes yet.</Text>}
              {notes.map((n) => (
                <Group key={n.id} justify="space-between" align="flex-start" wrap="nowrap">
                  <div style={{ flex: 1 }}>
                    <RichTextView html={n.body} />
                    <Text size="xs" c="dimmed">
                      {n.author_name ?? "—"} · {dayjs(n.created_at).format("D MMM YYYY, HH:mm")}
                    </Text>
                  </div>
                  {canEdit && (
                    <ActionIcon color="red" variant="subtle" aria-label="Delete note"
                      onClick={() => delNoteM.mutate(n.id)}>
                      <IconX size={14} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
            </Stack>
            {canEdit && (
              <Stack gap="xs">
                <RichTextField value={newNote} onChange={setNewNote} placeholder="Add a note…" />
                <Group justify="flex-end">
                  <Button loading={addNoteM.isPending} disabled={!newNote} onClick={() => addNoteM.mutate()}>
                    Add note
                  </Button>
                </Group>
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
}
