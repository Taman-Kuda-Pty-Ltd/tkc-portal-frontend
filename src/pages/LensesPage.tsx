import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Activity, ScheduleLens } from "../api/types";

interface Draft {
  name: string;
  description: string;
  position: number;
  activity_ids: string[];
}

const EMPTY: Draft = { name: "", description: "", position: 0, activity_ids: [] };

export function LensesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ScheduleLens | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const lensesQ = useQuery({
    queryKey: ["schedule-lenses"],
    queryFn: () => api.get<ScheduleLens[]>("/schedule-lenses"),
  });
  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });

  const activityById = useMemo(
    () => new Map((activitiesQ.data ?? []).map((a) => [a.id, a])),
    [activitiesQ.data],
  );

  useEffect(() => {
    if (editing)
      setDraft({
        name: editing.name,
        description: editing.description ?? "",
        position: editing.position,
        activity_ids: editing.activity_ids.map(String),
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () => {
      const body = {
        name: draft.name,
        description: draft.description,
        position: draft.position,
        activity_ids: draft.activity_ids.map(Number),
      };
      return editing
        ? api.patch(`/schedule-lenses/${editing.id}`, body)
        : api.post("/schedule-lenses", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-lenses"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.del(`/schedule-lenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-lenses"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const activityOptions = (activitiesQ.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ value: String(a.id), label: a.name }));
  const open = editing !== null || creating;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Schedule lenses</Title>
        <Button onClick={() => setCreating(true)}>New lens</Button>
      </Group>
      <Text size="sm" c="dimmed">
        A lens focuses the schedule on a group of activities (e.g. “Agistment” =
        Stablehand + Groom). They appear as the tabs above the calendar.
      </Text>

      {lensesQ.isLoading ? (
        <Loader />
      ) : (
        <Stack>
          {(lensesQ.data ?? []).map((ln) => (
            <Group key={ln.id} justify="space-between" wrap="wrap" p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
              <div>
                <Group gap="xs">
                  <Text fw={600}>{ln.name}</Text>
                  {!ln.is_active && (
                    <Badge color="gray" variant="light">
                      inactive
                    </Badge>
                  )}
                </Group>
                <Group gap={6} mt={4}>
                  {ln.activity_ids.length === 0 && (
                    <Text size="xs" c="dimmed">
                      No activities
                    </Text>
                  )}
                  {ln.activity_ids.map((aid) => {
                    const a = activityById.get(aid);
                    return (
                      <Badge
                        key={aid}
                        size="sm"
                        variant="light"
                        leftSection={
                          <Box
                            w={8}
                            h={8}
                            style={{ borderRadius: "50%", background: a?.color ?? "#718096" }}
                          />
                        }
                      >
                        {a?.name ?? `#${aid}`}
                      </Badge>
                    );
                  })}
                </Group>
              </div>
              <Group gap="xs">
                <Button variant="subtle" onClick={() => setEditing(ln)}>
                  Edit
                </Button>
                <Button variant="subtle" color="red" onClick={() => deleteM.mutate(ln.id)}>
                  Delete
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      <Modal
        opened={open}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={editing ? `Edit ${editing.name}` : "New lens"}
      >
        <Stack>
          <TextInput
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.currentTarget.value })}
          />
          <MultiSelect
            label="Activities"
            data={activityOptions}
            value={draft.activity_ids}
            onChange={(v) => setDraft({ ...draft, activity_ids: v })}
            searchable
          />
          <NumberInput
            label="Order"
            description="Lower numbers appear first in the tab row"
            value={draft.position}
            onChange={(v) => setDraft({ ...draft, position: Number(v) || 0 })}
          />
          <Button loading={saveM.isPending} disabled={!draft.name} onClick={() => saveM.mutate()}>
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
