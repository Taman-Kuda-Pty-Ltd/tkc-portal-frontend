import { ActionIcon, Badge, Button, Card, Group, Select, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { Role } from "../api/types";

const CRED_TYPES = [
  { value: "wwcc", label: "Working With Children" },
  { value: "first_aid", label: "First Aid" },
  { value: "coaching", label: "Coaching accreditation" },
  { value: "police_check", label: "Police check" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "other", label: "Other" },
];
const credLabel = (t: string) => CRED_TYPES.find((c) => c.value === t)?.label ?? t;

interface RequiredCred { id: number; credential_type: string; role_id: number | null }

/** CRED-ATTENTION: configure the credentials every worker (or every holder of a role)
 * must have. Missing/unverified ones surface as attention items. */
export function RequiredCredentialsSection() {
  const qc = useQueryClient();
  const reqQ = useQuery({ queryKey: ["required-credentials"], queryFn: () => api.get<RequiredCred[]>("/settings/required-credentials") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const [type, setType] = useState<string>("wwcc");
  const [roleId, setRoleId] = useState<string>("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["required-credentials"] });
    qc.invalidateQueries({ queryKey: ["cred-attention-count"] });
  };
  const addM = useMutation({
    mutationFn: () => api.post("/settings/required-credentials", {
      credential_type: type, role_id: roleId === "all" ? null : Number(roleId),
    }),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/settings/required-credentials/${id}`),
    onSuccess: invalidate,
  });

  const roleName = (id: number | null) =>
    id == null ? "All staff" : (rolesQ.data ?? []).find((r) => r.id === id)?.name ?? `Role ${id}`;
  const roleOpts = [{ value: "all", label: "All staff" },
    ...(rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Credentials every worker (or every holder of a role) must hold. A missing or
        unverified one raises an attention item; managers verify a copy or mark it sighted.
      </Text>
      <Card withBorder>
        <Group align="flex-end">
          <Select label="Credential" w={220} data={CRED_TYPES} value={type}
            onChange={(v) => v && setType(v)} allowDeselect={false} />
          <Select label="Applies to" w={200} data={roleOpts} value={roleId}
            onChange={(v) => v && setRoleId(v)} allowDeselect={false} />
          <Button loading={addM.isPending} onClick={() => addM.mutate()}>Add requirement</Button>
        </Group>
      </Card>
      {(reqQ.data ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">No required credentials configured.</Text>
      ) : (
        <Stack gap={4}>
          {(reqQ.data ?? []).map((r) => (
            <Group key={r.id} justify="space-between">
              <Group gap={8}>
                <Text size="sm" fw={500}>{credLabel(r.credential_type)}</Text>
                <Badge variant="light" size="sm">{roleName(r.role_id)}</Badge>
              </Group>
              <ActionIcon color="red" variant="subtle" aria-label="Remove"
                onClick={() => delM.mutate(r.id)}><IconTrash size={16} /></ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
