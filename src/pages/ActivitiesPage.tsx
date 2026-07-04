import {
  ActionIcon,
  Badge,
  Button,
  ColorInput,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Activity, ActivityHeading, Role } from "../api/types";

interface Draft {
  slug: string;
  name: string;
  abbreviation: string;
  description: string;
  color: string;
  is_active: boolean;
  is_lesson: boolean;
}

const EMPTY: Draft = { slug: "", name: "", abbreviation: "", description: "", color: "#2f855a", is_active: true, is_lesson: false };

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
        abbreviation: editing.abbreviation ?? "",
        description: editing.description ?? "",
        color: editing.color ?? "#2f855a",
        is_active: editing.is_active,
        is_lesson: editing.is_lesson,
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () =>
      editing
        ? api.patch(`/activities/${editing.id}`, {
            name: draft.name,
            abbreviation: draft.abbreviation || null,
            description: draft.description,
            color: draft.color,
            is_active: draft.is_active,
            is_lesson: draft.is_lesson,
          })
        : api.post("/activities", {
            slug: draft.slug,
            name: draft.name,
            abbreviation: draft.abbreviation || null,
            description: draft.description,
            color: draft.color,
            is_lesson: draft.is_lesson,
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
            label="Abbreviation"
            description="Default compact label for month view, e.g. SH"
            maxLength={10}
            value={draft.abbreviation}
            onChange={(e) => setDraft({ ...draft, abbreviation: e.currentTarget.value })}
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
          <Switch
            label="Lesson activity"
            description="Adds a facility and riders (student + horse) to its shifts"
            checked={draft.is_lesson}
            onChange={(e) => setDraft({ ...draft, is_lesson: e.currentTarget.checked })}
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

          {editing && (
            <>
              <Divider label="Headings" labelPosition="left" mt="sm" />
              <HeadingsEditor
                activity={(q.data ?? []).find((a) => a.id === editing.id) ?? editing}
              />
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

function HeadingsEditor({ activity }: { activity: Activity }) {
  const qc = useQueryClient();
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const addM = useMutation({
    mutationFn: () => api.post(`/activities/${activity.id}/headings`, { label: "Staff", count: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const headings = activity.headings.filter((h) => h.is_active);
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Who staffs this activity. Each heading is filled by people who hold the chosen
        role (leave as “Anyone” for no restriction).
      </Text>
      {headings.length === 0 && <Text size="sm" c="dimmed">No headings yet.</Text>}
      {headings.map((h) => (
        <HeadingRow key={h.id} activityId={activity.id} heading={h} roleOptions={roleOptions} />
      ))}
      <Group>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
          loading={addM.isPending} onClick={() => addM.mutate()}>
          Add heading
        </Button>
      </Group>
    </Stack>
  );
}

function HeadingRow({
  activityId,
  heading,
  roleOptions,
}: {
  activityId: number;
  heading: ActivityHeading;
  roleOptions: { value: string; label: string }[];
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(heading.label);
  const patchM = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/activities/${activityId}/headings/${heading.id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => api.del(`/activities/${activityId}/headings/${heading.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <TextInput label="Label" style={{ flex: 1 }} value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
        onBlur={() => label.trim() && label !== heading.label && patchM.mutate({ label: label.trim() })} />
      <Select label="Eligible role" data={roleOptions} placeholder="Anyone" clearable w={150}
        value={heading.qualifying_role_id ? String(heading.qualifying_role_id) : null}
        onChange={(v) => patchM.mutate({ qualifying_role_id: v ? Number(v) : null })}
        comboboxProps={{ withinPortal: true }} />
      <NumberInput label="Count" min={1} w={72} value={heading.count}
        onChange={(v) => patchM.mutate({ count: Number(v) || 1 })} />
      <ActionIcon color="red" variant="subtle" mb={6} aria-label="Delete heading"
        onClick={() => delM.mutate()}>
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
}
