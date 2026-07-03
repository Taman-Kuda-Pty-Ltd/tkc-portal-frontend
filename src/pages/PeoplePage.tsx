import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person, Role } from "../api/types";

interface Draft {
  given_name: string;
  middle_names: string;
  family_name: string;
  preferred_name: string;
  email: string;
  mobile: string;
  password: string;
  is_active: boolean;
  role_ids: string[];
}

const EMPTY: Draft = {
  given_name: "",
  middle_names: "",
  family_name: "",
  preferred_name: "",
  email: "",
  mobile: "",
  password: "",
  is_active: true,
  role_ids: [],
};

export function PeoplePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });

  useEffect(() => {
    if (editing)
      setDraft({
        given_name: editing.given_name,
        middle_names: editing.middle_names ?? "",
        family_name: editing.family_name,
        preferred_name: editing.preferred_name ?? "",
        email: editing.email ?? "",
        mobile: editing.mobile ?? "",
        password: "",
        is_active: editing.is_active,
        role_ids: editing.roles.map((r) => String(r.id)),
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () => {
      const roleIds = draft.role_ids.map(Number);
      const core = {
        given_name: draft.given_name,
        middle_names: draft.middle_names || null,
        family_name: draft.family_name,
        preferred_name: draft.preferred_name || null,
        email: draft.email || null,
        mobile: draft.mobile || null,
        role_ids: roleIds,
      };
      if (editing) {
        const body: Record<string, unknown> = { ...core, is_active: draft.is_active };
        if (draft.password) body.password = draft.password;
        return api.patch(`/people/${editing.id}`, body);
      }
      return api.post("/people", { ...core, password: draft.password || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const open = editing !== null || creating;

  function statusBadge(p: Person) {
    if (!p.is_active) return <Badge color="gray" variant="light">Disabled</Badge>;
    if (!p.onboarded) return <Badge color="yellow" variant="light">Invited</Badge>;
    return <Badge color="teal" variant="light">Active</Badge>;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>People</Title>
        <Button onClick={() => setCreating(true)}>Add person</Button>
      </Group>

      {peopleQ.isLoading ? (
        <Loader />
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Roles</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(peopleQ.data ?? []).map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.full_name}</Table.Td>
                  <Table.Td>{p.email ?? <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {p.roles.map((r) => (
                        <Badge key={r.id} size="sm" variant="light">
                          {r.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>{statusBadge(p)}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={open}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={editing ? `Edit ${editing.full_name}` : "Add person"}
        size="lg"
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Given name"
              value={draft.given_name}
              onChange={(e) => setDraft({ ...draft, given_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Family name"
              value={draft.family_name}
              onChange={(e) => setDraft({ ...draft, family_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Middle name/s"
              value={draft.middle_names}
              onChange={(e) => setDraft({ ...draft, middle_names: e.currentTarget.value })}
            />
            <TextInput
              label="Preferred name"
              placeholder="Shown on the schedule"
              value={draft.preferred_name}
              onChange={(e) => setDraft({ ...draft, preferred_name: e.currentTarget.value })}
            />
            <TextInput
              label="Email"
              type="email"
              value={draft.email}
              disabled={!!editing}
              onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })}
            />
            <TextInput
              label="Mobile"
              value={draft.mobile}
              onChange={(e) => setDraft({ ...draft, mobile: e.currentTarget.value })}
            />
          </SimpleGrid>
          <MultiSelect
            label="Roles"
            data={roleOptions}
            value={draft.role_ids}
            onChange={(v) => setDraft({ ...draft, role_ids: v })}
            searchable
          />
          <PasswordInput
            label={editing ? "Reset password (optional)" : "Password (optional)"}
            description={!editing ? "Leave blank to onboard by invitation later." : undefined}
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.currentTarget.value })}
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
            disabled={!draft.given_name || !draft.family_name}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
