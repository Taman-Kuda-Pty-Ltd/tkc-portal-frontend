import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Role } from "../api/types";
import { CAPABILITY_LABELS } from "../lib/constants";

interface Draft {
  slug: string;
  name: string;
  description: string;
  capabilities: string[];
}

const EMPTY: Draft = { slug: "", name: "", description: "", capabilities: [] };

export function RolesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const capsQ = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<string[]>("/roles/capabilities"),
  });

  useEffect(() => {
    if (editing)
      setDraft({
        slug: editing.slug,
        name: editing.name,
        description: editing.description ?? "",
        capabilities: editing.capabilities,
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  const saveM = useMutation({
    mutationFn: () =>
      editing
        ? api.patch(`/roles/${editing.id}`, {
            name: draft.name,
            description: draft.description,
            capabilities: draft.capabilities,
          })
        : api.post("/roles", draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
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
          Each role grants a set of capabilities. A person can hold several roles;
          their permissions are the combination.
        </Text>
        <Button style={{ flexShrink: 0 }} onClick={() => setCreating(true)}>
          New role
        </Button>
      </Group>

      {rolesQ.isLoading ? (
        <Loader />
      ) : (
        <Stack>
          {(rolesQ.data ?? []).map((r) => (
            <Card key={r.id} withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Group gap="xs">
                    <Text fw={600}>{r.name}</Text>
                    <Badge variant="light" color="gray">
                      {r.slug}
                    </Badge>
                  </Group>
                  <Group gap={4} mt={4}>
                    {r.capabilities.length === 0 && (
                      <Text size="xs" c="dimmed">
                        No capabilities
                      </Text>
                    )}
                    {r.capabilities.map((c) => (
                      <Badge key={c} size="xs" variant="dot">
                        {CAPABILITY_LABELS[c] ?? c}
                      </Badge>
                    ))}
                  </Group>
                </div>
                <Button variant="light" onClick={() => setEditing(r)}>
                  Edit
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={open}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={editing ? `Edit ${editing.name}` : "New role"}
      >
        <Stack>
          {!editing && (
            <TextInput
              label="Slug"
              description="Short id, e.g. 'farrier'"
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
          <div>
            <Text size="sm" fw={500} mb={4}>
              Capabilities
            </Text>
            <SimpleGrid cols={2} spacing={4}>
              {(capsQ.data ?? []).map((c) => (
                <Checkbox
                  key={c}
                  label={CAPABILITY_LABELS[c] ?? c}
                  checked={draft.capabilities.includes(c)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      capabilities: e.currentTarget.checked
                        ? [...draft.capabilities, c]
                        : draft.capabilities.filter((x) => x !== c),
                    })
                  }
                />
              ))}
            </SimpleGrid>
          </div>
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
