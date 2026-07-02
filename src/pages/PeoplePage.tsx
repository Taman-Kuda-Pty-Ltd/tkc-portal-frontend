import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  PasswordInput,
  Stack,
  Switch,
  Table,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person, Role } from "../api/types";

interface Draft {
  full_name: string;
  email: string;
  password: string;
  is_active: boolean;
  role_ids: string[];
}

const EMPTY: Draft = { full_name: "", email: "", password: "", is_active: true, role_ids: [] };

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
        full_name: editing.full_name,
        email: editing.email,
        password: "",
        is_active: editing.is_active,
        role_ids: editing.roles.map((r) => String(r.id)),
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () => {
      const roleIds = draft.role_ids.map(Number);
      if (editing) {
        const body: Record<string, unknown> = {
          full_name: draft.full_name,
          is_active: draft.is_active,
          role_ids: roleIds,
        };
        if (draft.password) body.password = draft.password;
        return api.patch(`/people/${editing.id}`, body);
      }
      return api.post("/people", {
        full_name: draft.full_name,
        email: draft.email,
        password: draft.password,
        role_ids: roleIds,
      });
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

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>People</Title>
        <Button onClick={() => setCreating(true)}>Add person</Button>
      </Group>

      {peopleQ.isLoading ? (
        <Loader />
      ) : (
        <Table.ScrollContainer minWidth={500}>
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
                  <Table.Td>{p.email}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {p.roles.map((r) => (
                        <Badge key={r.id} size="sm" variant="light">
                          {r.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {p.is_active ? (
                      <Badge color="teal" variant="light">
                        Active
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Disabled
                      </Badge>
                    )}
                  </Table.Td>
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
      >
        <Stack>
          <TextInput
            label="Full name"
            value={draft.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Email"
            type="email"
            value={draft.email}
            disabled={!!editing}
            onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })}
            required
          />
          <PasswordInput
            label={editing ? "Reset password (optional)" : "Password"}
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.currentTarget.value })}
            required={!editing}
          />
          <MultiSelect
            label="Roles"
            data={roleOptions}
            value={draft.role_ids}
            onChange={(v) => setDraft({ ...draft, role_ids: v })}
            searchable
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
            disabled={!draft.full_name || (!editing && (!draft.email || !draft.password))}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
