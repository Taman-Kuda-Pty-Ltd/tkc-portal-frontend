import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Collapse,
  Divider,
  Group,
  Menu,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconDots, IconPlus, IconX } from "@tabler/icons-react";
import { TimeField } from "./TimeField";
import { DateField } from "./DateField";
import { RichTextField, RichTextView } from "./RichText";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Activity, Clash, NamedResource, Role, Shift } from "../api/types";
import { StaffAssign } from "./StaffAssign";

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
  canAssign = false,
  canManageShifts = false,
  onRecordAttendance,
}: {
  shift: Shift | null;
  defaultDate: Date;
  opened: boolean;
  onClose: () => void;
  canEdit: boolean;
  canAssign?: boolean;
  canManageShifts?: boolean;
  onRecordAttendance?: (shift: Shift, personId: number, personName: string) => void;
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
  const [newNote, setNewNote] = useState("");
  const [headingCounts, setHeadingCounts] = useState<Record<number, number>>({});
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [payHours, setPayHours] = useState<number | string>("");
  const [rides, setRides] = useState<RideDraft[]>([]);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const isDraft = shift?.status === "draft";
  const isPublished = shift?.status === "published";

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: () => api.get<NamedResource[]>("/facilities") });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => api.get<NamedResource[]>("/students") });
  const horsesQ = useQuery({ queryKey: ["horses"], queryFn: () => api.get<NamedResource[]>("/horses") });

  // Reset every form field from the shift (or blank, for a new one). Used both on
  // (re)open and when discarding an in-progress edit.
  function seedForm(s: Shift | null) {
    setNewNote("");
    setCancelling(false);
    setAmendmentReason("");
    if (s) {
      setActivityId(String(s.activity_id));
      setRoleId(s.role_id ? String(s.role_id) : null);
      setAbbreviation(s.abbreviation ?? "");
      setTitle(s.title ?? "");
      setShowLabels(!!(s.title || s.abbreviation));
      setDescription(s.description ?? "");
      setDate(dayjs(s.starts_at).toDate());
      setStart(dayjs(s.starts_at).format("HH:mm"));
      setEnd(dayjs(s.ends_at).format("HH:mm"));
      setHeadcount(s.headcount);
      setHeadingCounts(Object.fromEntries(s.heading_counts.map((c) => [c.heading_id, c.count])));
      setFacilityId(s.facility_id ? String(s.facility_id) : null);
      setPayHours(s.pay_hours ?? "");
      setRides(s.rides.map((r) => ({
        student_id: String(r.student_id),
        horse_id: r.horse_id ? String(r.horse_id) : null,
      })));
    } else {
      setActivityId(null);
      setRoleId(null);
      setAbbreviation("");
      setTitle("");
      setShowLabels(false);
      setDescription("");
      setDate(defaultDate);
      setStart("08:00");
      setEnd("12:00");
      setHeadcount(1);
      setHeadingCounts({});
      setFacilityId(null);
      setPayHours("");
      setRides([]);
    }
  }

  // Seed the form only when the modal opens or the shift *identity* changes — not
  // when the same shift's data refreshes underneath (which would clobber edits in
  // progress). Live refreshes still flow to read-through displays (notes, staff).
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!opened) {
      loadedKey.current = null;
      return;
    }
    const key = shift ? `s${shift.id}` : "new";
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setEditing(shift === null); // new shift opens straight into edit
    seedForm(shift);
  }, [shift, opened, defaultDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedActivity = (activitiesQ.data ?? []).find((a) => a.id === Number(activityId));
  const headings = (selectedActivity?.headings ?? []).filter((h) => h.is_active);
  const isLesson = !!selectedActivity?.is_lesson;
  const horseIds = rides.map((r) => r.horse_id).filter(Boolean).map(Number);

  // New lessons prefill their pay from the activity's default (blank → org default).
  useEffect(() => {
    if (!opened || shift) return;
    setPayHours(selectedActivity?.is_lesson ? (selectedActivity.default_lesson_hours ?? "") : "");
  }, [activityId, opened, shift]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set the required role from the activity's default (Lesson→Coach etc.).
  useEffect(() => {
    if (!opened || !selectedActivity) return;
    if (selectedActivity.default_role_id) setRoleId(String(selectedActivity.default_role_id));
  }, [activityId, opened]); // eslint-disable-line react-hooks/exhaustive-deps

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
        pay_hours: payHours !== "" ? Number(payHours) : null,
        amendment_reason: isPublished ? amendmentReason.trim() || null : null,
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
  const publishM = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/publish`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); onClose(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const cancelM = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/cancel`, { reason: cancelReason.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); onClose(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Notes render from the live shift prop (kept fresh by the parent after each
  // ["shifts"] invalidation), so add/delete just need to invalidate.
  const notes = shift?.notes ?? [];
  const addNoteM = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/notes`, { body: newNote.trim() }),
    onSuccess: () => {
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const delNoteM = useMutation({
    mutationFn: (noteId: number) => api.del(`/shifts/${shift!.id}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
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
        {shift && (
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Group gap="xs">
              <Badge variant="light" color={isDraft ? "gray" : isPublished ? "teal" : "red"}>
                {shift.status}
              </Badge>
              {isDraft && <Text size="xs" c="dimmed">Staff can't see this until it's published.</Text>}
            </Group>
            {canEdit && (
              <Group gap="xs" wrap="nowrap">
                {!editing && <Button size="xs" variant="light" onClick={() => setEditing(true)}>Edit</Button>}
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="More actions">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {isDraft ? (
                      <Menu.Item color="red" onClick={() => deleteM.mutate()}>Delete draft</Menu.Item>
                    ) : (
                      <Menu.Item color="orange" onClick={() => { setEditing(true); setCancelling(true); }}>
                        Cancel shift
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Group>
        )}
        <Divider label="Details" labelPosition="left" />
        {/* Activity drives the labels + role — usually the only choice you need. */}
        <Select label="Activity" data={activityOptions} value={activityId} onChange={setActivityId}
          required disabled={ro} comboboxProps={{ withinPortal: true }} />
        {/* The role is dictated by the activity when it has a default; only editable otherwise (e.g. "Other"). */}
        {selectedActivity?.default_role_id ? (
          <Text size="sm" c="dimmed">
            Role: <b>{roleOptions.find((r) => r.value === roleId)?.label ?? "—"}</b> (set by the activity)
          </Text>
        ) : (
          <Select label="Required role" data={roleOptions} value={roleId} onChange={setRoleId}
            placeholder="Any" clearable disabled={ro} comboboxProps={{ withinPortal: true }} />
        )}

        {/* Title/abbreviation auto-mirror the activity; opt in to override (SC-6). */}
        {(!ro || title || abbreviation) && (
          <div>
            <Button variant="subtle" size="compact-sm" color="gray" px={4} disabled={ro && !showLabels}
              leftSection={showLabels ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              onClick={() => setShowLabels((s) => !s)}>
              Custom name &amp; abbreviation
              {!showLabels && !title && !abbreviation && (
                <Badge ml={8} size="xs" variant="light" color="teal">Auto</Badge>
              )}
            </Button>
            <Collapse in={showLabels}>
              <Stack gap="xs" mt="xs">
                <TextInput
                  label={
                    <Group gap={6} component="span">
                      <span>Title</span>
                      {!title && selectedActivity && <Badge size="xs" variant="light" color="teal">Auto</Badge>}
                    </Group>
                  }
                  placeholder={selectedActivity ? selectedActivity.name : "Short label"}
                  value={title} disabled={ro} onChange={(e) => setTitle(e.currentTarget.value)} />
                <TextInput
                  label={
                    <Group gap={6} component="span">
                      <span>Abbreviation</span>
                      {!abbreviation && selectedActivity && <Badge size="xs" variant="light" color="teal">Auto</Badge>}
                    </Group>
                  }
                  placeholder={selectedActivity?.abbreviation || selectedActivity?.name || "e.g. AM"}
                  maxLength={10} value={abbreviation} disabled={ro}
                  onChange={(e) => setAbbreviation(e.currentTarget.value)} />
              </Stack>
            </Collapse>
          </div>
        )}

        <DateField label="Date" value={date} onChange={setDate} required disabled={ro} />
        <Group>
          <TimeField label="Start" value={start} onChange={setStart} disabled={ro} />
          <TimeField label="End" value={end} onChange={setEnd} disabled={ro} />
        </Group>
        <NumberInput label="Pay duration (hours)"
          description={isLesson
            ? "Lessons are piece-work (1 lesson = 1h). Blank uses the lesson type default."
            : "Hours used for pay. Blank uses the shift length."}
          min={0} step={0.25} w={220} value={payHours} onChange={setPayHours} disabled={ro} />
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

        {editing && isPublished && (
          <Textarea label="Reason for change"
            description="Required if you change the time, pay or activity — staff are notified."
            value={amendmentReason} autosize minRows={1}
            onChange={(e) => setAmendmentReason(e.currentTarget.value)} />
        )}

        {editing && cancelling && (
          <Alert color="orange" title="Cancel this shift?">
            <Stack gap="xs">
              <Textarea placeholder="Reason (optional — sent to staff/clients)"
                value={cancelReason} autosize minRows={1}
                onChange={(e) => setCancelReason(e.currentTarget.value)} />
              <Group justify="flex-end">
                <Button variant="default" size="xs" onClick={() => setCancelling(false)}>Back</Button>
                <Button color="orange" size="xs" loading={cancelM.isPending} onClick={() => cancelM.mutate()}>
                  Confirm cancel
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {editing ? (
          <Group justify="flex-end" gap="xs">
            {/* New shift can be abandoned; existing edits discard and return to view. */}
            <Button variant="default" onClick={() => { if (shift) { seedForm(shift); setEditing(false); } else { onClose(); } }}>
              {shift ? "Cancel" : "Discard"}
            </Button>
            {isDraft && (
              <Button color="teal" loading={publishM.isPending} onClick={() => publishM.mutate()}>
                Publish
              </Button>
            )}
            <Button loading={saveM.isPending} disabled={!activityId} onClick={() => saveM.mutate()}>
              Save
            </Button>
          </Group>
        ) : (
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Close</Button>
          </Group>
        )}

        {shift && canAssign && (() => {
          // Staff attach to the shift's *saved* activity/headings (not the edit dropdown).
          const savedActivity = (activitiesQ.data ?? []).find((a) => a.id === shift.activity_id);
          return (
            <>
              <Divider label={savedActivity?.is_lesson ? "Coaches & staff" : "Staff"} labelPosition="left" />
              <StaffAssign
                shift={shift}
                activity={savedActivity}
                canAssign={canAssign}
                canManageShifts={canManageShifts}
                onRecordAttendance={onRecordAttendance}
              />
            </>
          );
        })()}

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
