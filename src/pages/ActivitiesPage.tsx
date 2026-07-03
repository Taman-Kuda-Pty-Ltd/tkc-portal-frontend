import {
  Badge,
  Button,
  ColorInput,
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity } from "../api/types";

interface Draft {
  slug: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

const EMPTY: Draft = { slug: "", name: "", description: "", color: "#2f855a", is_active: true };

export function ActivitiesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const q = useQuery({ queryKey: ["activities"], queryFn: () => api.get<Activity[]>("/activities") });

  useEffect(() => {
    if (editing)
      setDraft({
        slug: editing.slug,
        name: editing.name,
        description: editing.description ?? "",
        color: editing.color ?? "#2f855a",
        is_active: editing.is_active,
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () =>
      editing
        ? api.patch(`/activities/${editing.id}`, {
            name: draft.name,
            description: draft.description,
            color: draft.color,
            is_active: draft.is_active,
          })
        : api.post("/activities", {
            slug: draft.slug,
            name: draft.name,
            description: draft.description,
            color: draft.color,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const open = editing !== null || creating;

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Text size="sm" c="dimmed" style={{ flex: 1 }}>
          The kinds of work a shift represents. Activities tag shifts and drive the
          hours reports.
        </Text>
        <Button onClick={() => setCreating(true)} style={{ flexShrink: 0 }}>
          New activity
        </Button>
      </Group>

      {q.isLoading ? (
        <Loader />
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Activity</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Group gap="xs">
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: a.color ?? "#ccc",
                        display: "inline-block",
                      }}
                    />
                    {a.name}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="gray">
                    {a.slug}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={a.is_active ? "teal" : "gray"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="subtle" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={open}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={editing ? `Edit ${editing.name}` : "New activity"}
      >
        <Stack>
          {!editing && (
            <TextInput
              label="Slug"
              description="Short id, e.g. 'mucking'"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.currentTarget.value })}
              required
            />
          )}
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
          <ColorInput
            label="Colour"
            value={draft.color}
            onChange={(v) => setDraft({ ...draft, color: v })}
          />
          {editing && (
            <Switch
              label="Active"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.currentTarget.checked })}
            />
          )}
          <Button
            loading={saveM.isPending}
            disabled={!draft.name || (!editing && !draft.slug)}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
