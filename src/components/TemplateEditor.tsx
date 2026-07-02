import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity, RecurrenceUnit, Role, Template } from "../api/types";
import { RECURRENCE_OPTIONS, WEEKDAYS } from "../lib/constants";

interface SlotDraft {
  activity_id: string | null;
  role_id: string | null;
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
    weekday: "0",
    week_in_cycle: "0",
    day_of_month: 1,
    start_time: "08:00",
    end_time: "12:00",
    headcount: 1,
  };
}

export function TemplateEditor({
  template,
  opened,
  onClose,
}: {
  template: Template | null;
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

  const activityOptions = (activitiesQ.data ?? []).map((a) => ({
    value: String(a.id),
    label: a.name,
  }));
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));

  function updateSlot(i: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  const saveM = useMutation({
    mutationFn: () => {
      const payloadSlots = slots.map((s) => ({
        activity_id: Number(s.activity_id),
        role_id: s.role_id ? Number(s.role_id) : null,
        weekday:
          recurrence === "weekly" || recurrence === "fortnightly"
            ? Number(s.weekday)
            : null,
        week_in_cycle: recurrence === "fortnightly" ? Number(s.week_in_cycle) : null,
        day_of_month: recurrence === "monthly" ? s.day_of_month : null,
        start_time: s.start_time,
        end_time: s.end_time,
        headcount: s.headcount,
      }));
      const body = { name, description, recurrence, slots: payloadSlots };
      return template
        ? api.patch(`/templates/${template.id}`, body)
        : api.post("/templates", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const showWeekday = recurrence === "weekly" || recurrence === "fortnightly";
  const showCycle = recurrence === "fortnightly";
  const showDom = recurrence === "monthly";
  const invalid = !name || slots.length === 0 || slots.some((s) => !s.activity_id);

  return (
    <Modal opened={opened} onClose={onClose} title={template ? "Edit template" : "New template"} size="xl">
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
        {recurrence === "daily" && (
          <Text size="xs" c="dimmed">
            Daily: each slot repeats every day in the applied range.
          </Text>
        )}

        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Activity</Table.Th>
                <Table.Th>Role</Table.Th>
                {showWeekday && <Table.Th>Day</Table.Th>}
                {showCycle && <Table.Th>Week</Table.Th>}
                {showDom && <Table.Th>Day of month</Table.Th>}
                <Table.Th>Start</Table.Th>
                <Table.Th>End</Table.Th>
                <Table.Th>Need</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {slots.map((s, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Select
                      data={activityOptions}
                      value={s.activity_id}
                      onChange={(v) => updateSlot(i, { activity_id: v })}
                      placeholder="Activity"
                      w={140}
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      data={roleOptions}
                      value={s.role_id}
                      onChange={(v) => updateSlot(i, { role_id: v })}
                      placeholder="Any"
                      clearable
                      w={130}
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Table.Td>
                  {showWeekday && (
                    <Table.Td>
                      <Select
                        data={WEEKDAYS}
                        value={s.weekday}
                        onChange={(v) => updateSlot(i, { weekday: v })}
                        w={120}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                  )}
                  {showCycle && (
                    <Table.Td>
                      <Select
                        data={[
                          { value: "0", label: "Week A" },
                          { value: "1", label: "Week B" },
                        ]}
                        value={s.week_in_cycle}
                        onChange={(v) => updateSlot(i, { week_in_cycle: v })}
                        w={100}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                  )}
                  {showDom && (
                    <Table.Td>
                      <NumberInput
                        min={1}
                        max={31}
                        value={s.day_of_month ?? 1}
                        onChange={(v) => updateSlot(i, { day_of_month: Number(v) })}
                        w={90}
                      />
                    </Table.Td>
                  )}
                  <Table.Td>
                    <TimeInput
                      value={s.start_time}
                      onChange={(e) => updateSlot(i, { start_time: e.currentTarget.value })}
                      w={100}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TimeInput
                      value={s.end_time}
                      onChange={(e) => updateSlot(i, { end_time: e.currentTarget.value })}
                      w={100}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={1}
                      value={s.headcount}
                      onChange={(v) => updateSlot(i, { headcount: Number(v) || 1 })}
                      w={70}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}
                      aria-label="Remove slot"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

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
