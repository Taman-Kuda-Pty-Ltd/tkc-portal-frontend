import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity, Person, RecurrenceUnit, Role, ShiftTemplate } from "../api/types";
import { RECURRENCE_OPTIONS, WEEKDAYS } from "../lib/constants";
import { TimeField } from "./TimeField";

interface SlotDraft {
  activity_id: string | null;
  role_id: string | null;
  assigned_person_id: string | null;
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
    activity_id: null,
    role_id: null,
    assigned_person_id: null,
    description: "",
    weekday: "0",
    week_in_cycle: "0",
    day_of_month: 1,
    start_time: "08:00",
    end_time: "12:00",
    headcount: 1,
  };
}

export function ShiftTemplateEditor({
  template,
  opened,
  onClose,
}: {
  template: ShiftTemplate | null;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceUnit>("weekly");
  const [slots, setSlots] = useState<SlotDraft[]>([]);

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });

  useEffect(() => {
    if (!opened) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setRecurrence(template.recurrence);
      setSlots(
        template.slots.map((s) => ({
          activity_id: String(s.activity_id),
          role_id: s.role_id ? String(s.role_id) : null,
          assigned_person_id: s.assigned_person_id ? String(s.assigned_person_id) : null,
          description: s.description ?? "",
          weekday: s.weekday !== null ? String(s.weekday) : "0",
          week_in_cycle: s.week_in_cycle !== null ? String(s.week_in_cycle) : "0",
          day_of_month: s.day_of_month ?? 1,
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
          headcount: s.headcount,
        })),
      );
    } else {
      setName("");
      setDescription("");
      setRecurrence("weekly");
      setSlots([emptySlot()]);
    }
  }, [template, opened]);

  const activityOptions = (activitiesQ.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ value: String(a.id), label: a.name }));
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const peopleOptions = (peopleQ.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ value: String(p.id), label: p.full_name }));

  function updateSlot(i: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  const saveM = useMutation({
    mutationFn: () => {
      const payloadSlots = slots.map((s) => ({
        activity_id: Number(s.activity_id),
        role_id: s.role_id ? Number(s.role_id) : null,
        assigned_person_id: s.assigned_person_id ? Number(s.assigned_person_id) : null,
        description: s.description.trim() || null,
        weekday:
          recurrence === "weekly" || recurrence === "fortnightly" ? Number(s.weekday) : null,
        week_in_cycle: recurrence === "fortnightly" ? Number(s.week_in_cycle) : null,
        day_of_month: recurrence === "monthly" ? s.day_of_month : null,
        start_time: s.start_time,
        end_time: s.end_time,
        headcount: s.headcount,
      }));
      const body = { name, description, recurrence, slots: payloadSlots };
      return template
        ? api.patch(`/shift-templates/${template.id}`, body)
        : api.post("/shift-templates", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-templates"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const showWeekday = recurrence === "weekly" || recurrence === "fortnightly";
  const showCycle = recurrence === "fortnightly";
  const showDom = recurrence === "monthly";
  const invalid = !name || slots.length === 0 || slots.some((s) => !s.activity_id);

  return (
    <Modal opened={opened} onClose={onClose} title={template ? "Edit template" : "New template"} size="lg" closeOnClickOutside={false}>
      <Stack>
        <Group grow align="flex-start">
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <Select
            label="Recurrence"
            data={RECURRENCE_OPTIONS}
            value={recurrence}
            onChange={(v) => setRecurrence((v as RecurrenceUnit) ?? "weekly")}
            allowDeselect={false}
          />
        </Group>
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />

        <Divider label="Slots" labelPosition="left" />
        <Text size="xs" c="dimmed">
          Each slot is one recurring shift. Description is an optional calendar
          label (falls back to the activity name). Role is optional (leave as
          “Any”). “People” is how many staff the shift needs.
          {recurrence === "daily" && " Daily slots repeat every day in the applied range."}
        </Text>

        <Stack gap="xs">
          {slots.map((s, i) => (
            <Paper key={i} withBorder p="sm" radius="sm">
              <Group gap="sm" align="flex-end" wrap="wrap">
                <TextInput
                  label="Description"
                  placeholder="Optional label"
                  value={s.description}
                  onChange={(e) => updateSlot(i, { description: e.currentTarget.value })}
                  w={160}
                />
                <Select
                  label="Activity"
                  data={activityOptions}
                  value={s.activity_id}
                  onChange={(v) => updateSlot(i, { activity_id: v })}
                  placeholder="Activity"
                  w={150}
                  comboboxProps={{ withinPortal: true }}
                />
                <Select
                  label="Role"
                  data={roleOptions}
                  value={s.role_id}
                  onChange={(v) => updateSlot(i, { role_id: v })}
                  placeholder="Any"
                  clearable
                  w={140}
                  comboboxProps={{ withinPortal: true }}
                />
                <Select
                  label="Assignee"
                  data={peopleOptions}
                  value={s.assigned_person_id}
                  onChange={(v) => updateSlot(i, { assigned_person_id: v })}
                  placeholder="Unassigned"
                  clearable
                  searchable
                  w={160}
                  comboboxProps={{ withinPortal: true }}
                />
                {showWeekday && (
                  <Select
                    label="Day"
                    data={WEEKDAYS}
                    value={s.weekday}
                    onChange={(v) => updateSlot(i, { weekday: v })}
                    w={130}
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                )}
                {showCycle && (
                  <Select
                    label="Week"
                    data={[
                      { value: "0", label: "Week A" },
                      { value: "1", label: "Week B" },
                    ]}
                    value={s.week_in_cycle}
                    onChange={(v) => updateSlot(i, { week_in_cycle: v })}
                    w={110}
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                )}
                {showDom && (
                  <NumberInput
                    label="Day of month"
                    min={1}
                    max={31}
                    value={s.day_of_month ?? 1}
                    onChange={(v) => updateSlot(i, { day_of_month: Number(v) })}
                    w={110}
                  />
                )}
                <TimeField
                  label="Start"
                  value={s.start_time}
                  onChange={(v) => updateSlot(i, { start_time: v })}
                />
                <TimeField
                  label="End"
                  value={s.end_time}
                  onChange={(v) => updateSlot(i, { end_time: v })}
                />
                <NumberInput
                  label="People"
                  min={1}
                  value={s.headcount}
                  onChange={(v) => updateSlot(i, { headcount: Number(v) || 1 })}
                  w={80}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  mb={6}
                  onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}
                  aria-label="Remove slot"
                  disabled={slots.length === 1}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Group justify="space-between">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setSlots([...slots, emptySlot()])}
          >
            Add slot
          </Button>
          <Button loading={saveM.isPending} disabled={invalid} onClick={() => saveM.mutate()}>
            Save template
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
