import {
  ActionIcon,
  Anchor,
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
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Activity, Person, RecurrenceUnit, Role, ShiftTemplate } from "../api/types";
import { RECURRENCE_OPTIONS, WEEKDAYS } from "../lib/constants";
import { TimeField } from "../components/TimeField";

interface SlotDraft {
  activity_id: string | null;
  role_id: string | null;
  assigned_person_ids: string[];
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
    activity_id: null, role_id: null, assigned_person_ids: [],
    abbreviation: "", title: "", description: "",
    weekday: "0", week_in_cycle: "0", day_of_month: 1,
    start_time: "08:00", end_time: "12:00", headcount: 1,
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

  const updateSlot = (i: number, patch: Partial<SlotDraft>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const saveM = useMutation({
    mutationFn: () => {
      const payloadSlots = slots.map((s) => ({
        activity_id: Number(s.activity_id),
        role_id: s.role_id ? Number(s.role_id) : null,
        assigned_person_ids: s.assigned_person_ids.map(Number),
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

      <Group justify="space-between" align="center">
        <Title order={4}>Slots</Title>
        <Button variant="light" size="xs" leftSection={<IconPlus size={14} />}
          onClick={() => setSlots([...slots, emptySlot()])}>
          Add slot
        </Button>
      </Group>
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
              <ActionIcon color="red" variant="subtle" aria-label="Remove slot"
                disabled={slots.length === 1}
                onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}>
                <IconTrash size={18} />
              </ActionIcon>
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

              <Textarea label="Description" placeholder="Longer detail shown in the day view (optional)"
                value={s.description} autosize minRows={2}
                onChange={(e) => updateSlot(i, { description: e.currentTarget.value })} />
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Divider />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate("/templates")}>Cancel</Button>
        <Button loading={saveM.isPending} disabled={invalid} onClick={() => saveM.mutate()}>Save template</Button>
      </Group>
    </Stack>
  );
}
