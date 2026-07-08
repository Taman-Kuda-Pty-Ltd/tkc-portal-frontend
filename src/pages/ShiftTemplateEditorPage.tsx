import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconCopy, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Activity, NamedResource, Person, RecurrenceUnit, Role, ShiftTemplate } from "../api/types";
import { RECURRENCE_OPTIONS, WEEKDAYS } from "../lib/constants";
import { TimeField } from "../components/TimeField";
import { RichTextField } from "../components/RichText";

interface RiderDraft {
  student_id: string | null;
  horse_id: string | null;
}

interface SlotDraft {
  activity_id: string | null;
  role_id: string | null;
  assigned_person_ids: string[];
  riders: RiderDraft[];
  abbreviation: string;
  title: string;
  description: string;
  weekday: string | null;
  week_in_cycle: string | null;
  day_of_month: number | null;
  start_time: string;
  end_time: string;
  headcount: number;
}

function emptySlot(): SlotDraft {
  return {
    activity_id: null, role_id: null, assigned_person_ids: [], riders: [],
    abbreviation: "", title: "", description: "",
    weekday: "0", week_in_cycle: "0", day_of_month: 1,
    start_time: "08:00", end_time: "12:00", headcount: 1,
  };
}

/** Deep-copy a slot so a duplicate doesn't share nested arrays. */
function cloneSlot(s: SlotDraft): SlotDraft {
  return {
    ...s,
    assigned_person_ids: [...s.assigned_person_ids],
    riders: s.riders.map((r) => ({ ...r })),
  };
}

export function ShiftTemplateEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceUnit>("weekly");
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);

  const templateQ = useQuery({
    queryKey: ["shift-template", id],
    queryFn: () => api.get<ShiftTemplate>(`/shift-templates/${id}`),
    enabled: !isNew,
  });
  const activitiesQ = useQuery({ queryKey: ["activities"], queryFn: () => api.get<Activity[]>("/activities") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => api.get<NamedResource[]>("/students") });
  const horsesQ = useQuery({ queryKey: ["horses"], queryFn: () => api.get<NamedResource[]>("/horses") });

  const template = templateQ.data;
  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setRecurrence(template.recurrence);
    setSlots(template.slots.map((s) => ({
      activity_id: String(s.activity_id),
      role_id: s.role_id ? String(s.role_id) : null,
      assigned_person_ids: (s.assigned_person_ids ?? []).map(String),
      riders: (s.riders ?? []).map((r) => ({
        student_id: String(r.student_id),
        horse_id: r.horse_id ? String(r.horse_id) : null,
      })),
      abbreviation: s.abbreviation ?? "",
      title: s.title ?? "",
      description: s.description ?? "",
      weekday: s.weekday !== null ? String(s.weekday) : "0",
      week_in_cycle: s.week_in_cycle !== null ? String(s.week_in_cycle) : "0",
      day_of_month: s.day_of_month ?? 1,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      headcount: s.headcount,
    })));
  }, [template]);

  const activityOptions = (activitiesQ.data ?? []).filter((a) => a.is_active).map((a) => ({ value: String(a.id), label: a.name }));
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const peopleOptions = (peopleQ.data ?? []).filter((p) => p.is_active).map((p) => ({ value: String(p.id), label: p.full_name }));
  const studentOptions = (studentsQ.data ?? []).filter((s) => s.is_active).map((s) => ({ value: String(s.id), label: s.name }));
  const horseOptions = (horsesQ.data ?? []).filter((h) => h.is_active).map((h) => ({ value: String(h.id), label: h.name }));
  const isLessonActivity = (activityId: string | null) =>
    !!(activitiesQ.data ?? []).find((a) => a.id === Number(activityId))?.is_lesson;

  const updateSlot = (i: number, patch: Partial<SlotDraft>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const saveM = useMutation({
    mutationFn: () => {
      const payloadSlots = slots.map((s) => ({
        activity_id: Number(s.activity_id),
        role_id: s.role_id ? Number(s.role_id) : null,
        assigned_person_ids: s.assigned_person_ids.map(Number),
        riders: isLessonActivity(s.activity_id)
          ? s.riders
              .filter((r) => r.student_id)
              .map((r) => ({ student_id: Number(r.student_id), horse_id: r.horse_id ? Number(r.horse_id) : null }))
          : [],
        abbreviation: s.abbreviation.trim() || null,
        title: s.title.trim() || null,
        description: s.description.trim() || null,
        weekday: recurrence === "weekly" || recurrence === "fortnightly" ? Number(s.weekday) : null,
        week_in_cycle: recurrence === "fortnightly" ? Number(s.week_in_cycle) : null,
        day_of_month: recurrence === "monthly" ? s.day_of_month : null,
        start_time: s.start_time,
        end_time: s.end_time,
        headcount: s.headcount,
      }));
      const body = { name, description, recurrence, slots: payloadSlots };
      return isNew ? api.post("/shift-templates", body) : api.patch(`/shift-templates/${id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-templates"] });
      navigate("/templates");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const showWeekday = recurrence === "weekly" || recurrence === "fortnightly";
  const showCycle = recurrence === "fortnightly";
  const showDom = recurrence === "monthly";
  const invalid = !name || slots.length === 0 || slots.some((s) => !s.activity_id);

  if (!isNew && templateQ.isLoading) return <Loader />;

  return (
    <Stack maw={860} w="100%" mx="auto">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Anchor onClick={() => navigate("/templates")} c="dimmed">
            <Group gap={4}><IconArrowLeft size={16} /> Templates</Group>
          </Anchor>
          <Title order={2}>{isNew ? "New template" : "Edit template"}</Title>
        </Group>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate("/templates")}>Cancel</Button>
          <Button loading={saveM.isPending} disabled={invalid} onClick={() => saveM.mutate()}>Save template</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <Group grow align="flex-start">
          <TextInput label="Name" value={name} required onChange={(e) => setName(e.currentTarget.value)} />
          <Select label="Recurrence" data={RECURRENCE_OPTIONS} value={recurrence} allowDeselect={false}
            onChange={(v) => setRecurrence((v as RecurrenceUnit) ?? "weekly")} />
        </Group>
        <TextInput mt="sm" label="Description" placeholder="Optional"
          value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </Paper>

      <Title order={4}>Slots</Title>
      <Text size="sm" c="dimmed">
        Each slot is one recurring shift. Description is an optional calendar label
        (falls back to the activity name). Role is optional. “People” is how many
        staff the shift needs; assignees are pre-filled onto generated shifts.
        {recurrence === "daily" && " Daily slots repeat every day in the applied range."}
      </Text>

      <Stack>
        {slots.map((s, i) => (
          <Paper key={i} withBorder p="md" radius="sm">
            <Group justify="space-between" mb="sm">
              <Text fw={600} size="sm">Slot {i + 1}</Text>
              <Group gap={4}>
                <ActionIcon variant="subtle" color="gray" aria-label="Duplicate slot"
                  title="Duplicate this slot"
                  onClick={() => setSlots([...slots.slice(0, i + 1), cloneSlot(s), ...slots.slice(i + 1)])}>
                  <IconCopy size={17} />
                </ActionIcon>
                <ActionIcon color="red" variant="subtle" aria-label="Remove slot"
                  disabled={slots.length === 1}
                  onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}>
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Group>

            <Stack gap="sm">
              <Group align="flex-end" gap="sm" wrap="nowrap">
                <TextInput label="Title" placeholder="Short label (falls back to the activity name)"
                  style={{ flex: 1 }} value={s.title}
                  onChange={(e) => updateSlot(i, { title: e.currentTarget.value })} />
                <TextInput label="Abbreviation" placeholder="e.g. AM" maxLength={10} w={130}
                  value={s.abbreviation} onChange={(e) => updateSlot(i, { abbreviation: e.currentTarget.value })} />
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select label="Activity" data={activityOptions} value={s.activity_id} placeholder="Activity" required
                  onChange={(v) => updateSlot(i, { activity_id: v })} comboboxProps={{ withinPortal: true }} />
                <Select label="Role" data={roleOptions} value={s.role_id} placeholder="Any" clearable
                  onChange={(v) => updateSlot(i, { role_id: v })} comboboxProps={{ withinPortal: true }} />
              </SimpleGrid>

              <Group align="flex-end" gap="sm" wrap="wrap">
                {showWeekday && (
                  <Select label="Day" data={WEEKDAYS} value={s.weekday} w={130} allowDeselect={false}
                    onChange={(v) => updateSlot(i, { weekday: v })} comboboxProps={{ withinPortal: true }} />
                )}
                {showCycle && (
                  <Select label="Week" data={[{ value: "0", label: "Week A" }, { value: "1", label: "Week B" }]}
                    value={s.week_in_cycle} w={120} allowDeselect={false}
                    onChange={(v) => updateSlot(i, { week_in_cycle: v })} comboboxProps={{ withinPortal: true }} />
                )}
                {showDom && (
                  <NumberInput label="Day of month" min={1} max={31} w={130} value={s.day_of_month ?? 1}
                    onChange={(v) => updateSlot(i, { day_of_month: Number(v) })} />
                )}
                <TimeField label="Start" value={s.start_time} onChange={(v) => updateSlot(i, { start_time: v })} />
                <TimeField label="End" value={s.end_time} onChange={(v) => updateSlot(i, { end_time: v })} />
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <NumberInput label="People needed" min={1} value={s.headcount}
                  onChange={(v) => updateSlot(i, { headcount: Number(v) || 1 })} />
                <MultiSelect label="Assignees" data={peopleOptions} value={s.assigned_person_ids}
                  placeholder={s.assigned_person_ids.length ? undefined : "Unassigned"} searchable clearable
                  onChange={(v) => updateSlot(i, { assigned_person_ids: v })} comboboxProps={{ withinPortal: true }} />
              </SimpleGrid>

              {isLessonActivity(s.activity_id) && (
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={500}>Default riders</Text>
                    <Button size="compact-xs" variant="light" leftSection={<IconPlus size={13} />}
                      onClick={() => updateSlot(i, { riders: [...s.riders, { student_id: null, horse_id: null }] })}>
                      Add rider
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed" mb={6}>
                    Students (horse optional) pre-filled onto every lesson this slot generates.
                  </Text>
                  <Stack gap="xs">
                    {s.riders.length === 0 && <Text size="sm" c="dimmed">None — add the regular class.</Text>}
                    {s.riders.map((r, ri) => (
                      <Group key={ri} gap="xs" wrap="nowrap" align="flex-end">
                        <Select placeholder="Student" data={studentOptions} value={r.student_id} searchable
                          style={{ flex: 1 }} comboboxProps={{ withinPortal: true }}
                          onChange={(v) => updateSlot(i, {
                            riders: s.riders.map((x, xi) => (xi === ri ? { ...x, student_id: v } : x)),
                          })} />
                        <Text c="dimmed" pb={8}>on</Text>
                        <Select placeholder="Horse" data={horseOptions} value={r.horse_id} searchable clearable
                          style={{ flex: 1 }} comboboxProps={{ withinPortal: true }}
                          onChange={(v) => updateSlot(i, {
                            riders: s.riders.map((x, xi) => (xi === ri ? { ...x, horse_id: v } : x)),
                          })} />
                        <ActionIcon color="red" variant="subtle" aria-label="Remove rider"
                          onClick={() => updateSlot(i, { riders: s.riders.filter((_, xi) => xi !== ri) })}>
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                </div>
              )}

              <RichTextField label="Description" placeholder="Longer detail shown in the day view (optional)"
                value={s.description} onChange={(html) => updateSlot(i, { description: html })} />
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Group>
        <Button variant="light" leftSection={<IconPlus size={16} />}
          onClick={() => setSlots([...slots, emptySlot()])}>
          Blank slot
        </Button>
        <Button variant="default" leftSection={<IconCopy size={16} />} disabled={slots.length === 0}
          onClick={() => setSlots([...slots, cloneSlot(slots[slots.length - 1])])}>
          Copy last
        </Button>
      </Group>

      <SlotPreview
        slots={slots}
        recurrence={recurrence}
        activityName={(id) => activityOptions.find((a) => a.value === id)?.label ?? "Shift"}
      />

      <Divider />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate("/templates")}>Cancel</Button>
        <Button loading={saveM.isPending} disabled={invalid} onClick={() => saveM.mutate()}>Save template</Button>
      </Group>
    </Stack>
  );
}

/** A compact "what one cycle generates" preview (SC-10). Weekly/fortnightly show a
 *  Mon–Sun grid; daily/monthly a short summary. */
function SlotPreview({
  slots,
  recurrence,
  activityName,
}: {
  slots: SlotDraft[];
  recurrence: RecurrenceUnit;
  activityName: (activityId: string | null) => string;
}) {
  const ready = slots.filter((s) => s.activity_id);
  if (ready.length === 0) return null;

  const block = (s: SlotDraft, key: number) => (
    <Paper key={key} withBorder p={6} radius="sm" bg="var(--mantine-color-default)">
      <Text size="xs" fw={600} lineClamp={1}>{s.title || activityName(s.activity_id)}</Text>
      <Text size="xs" c="dimmed">{s.start_time}–{s.end_time}</Text>
      <Group gap={4} mt={2}>
        <Badge size="xs" variant="light" color="gray">{s.headcount} staff</Badge>
        {s.riders.filter((r) => r.student_id).length > 0 && (
          <Badge size="xs" variant="light" color="grape">
            {s.riders.filter((r) => r.student_id).length} riders
          </Badge>
        )}
      </Group>
    </Paper>
  );

  let body: ReactNode;
  if (recurrence === "weekly" || recurrence === "fortnightly") {
    body = (
      <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }} spacing="xs">
        {WEEKDAYS.map((d) => {
          const dayslots = ready
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => String(s.weekday) === d.value);
          return (
            <Stack key={d.value} gap={4}>
              <Text size="xs" fw={700} ta="center" c="dimmed">{d.label.slice(0, 3)}</Text>
              {dayslots.length === 0 && <Text size="xs" c="dimmed" ta="center">—</Text>}
              {dayslots.map(({ s, idx }) => block(s, idx))}
            </Stack>
          );
        })}
      </SimpleGrid>
    );
  } else if (recurrence === "daily") {
    body = (
      <>
        <Text size="xs" c="dimmed" mb={6}>Repeats every day in the applied range:</Text>
        <Group gap="xs">{ready.map((s, idx) => block(s, idx))}</Group>
      </>
    );
  } else {
    body = (
      <Stack gap={6}>
        {ready.map((s, idx) => (
          <Group key={idx} gap="xs" wrap="nowrap">
            <Badge size="sm" variant="light">Day {s.day_of_month ?? 1}</Badge>
            {block(s, idx)}
          </Group>
        ))}
      </Stack>
    );
  }

  return (
    <Paper withBorder p="md" radius="sm">
      <Text fw={600} size="sm" mb="xs">Preview — one cycle</Text>
      {body}
    </Paper>
  );
}
