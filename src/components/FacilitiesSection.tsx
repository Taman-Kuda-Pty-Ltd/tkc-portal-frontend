import { ActionIcon, Badge, Button, Card, Group, Modal, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Facility {
  id: number;
  name: string;
  position: number;
  is_active: boolean;
}

export function FacilitiesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Facility | null>(null);
  const q = useQuery({ queryKey: ["facilities"], queryFn: () => api.get<Facility[]>("/facilities") });

  const createM = useMutation({
    mutationFn: () => api.post("/facilities", { name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facilities"] }); setName(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">Places a lesson can run (arena, roundyard, trail…).</Text>
      <Group align="flex-end">
        <TextInput label="New facility" placeholder="e.g. Indoor arena" value={name} style={{ flex: 1 }}
          onChange={(e) => setName(e.currentTarget.value)} />
        <Button loading={createM.isPending} disabled={!name.trim()} onClick={() => createM.mutate()}>Add</Button>
      </Group>
      <Stack gap="xs">
        {(q.data ?? []).map((f) => (
          <Card key={f.id} withBorder padding="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600} c={f.is_active ? undefined : "dimmed"}>{f.name}</Text>
                {!f.is_active && <Badge variant="light" color="gray">Inactive</Badge>}
              </Group>
              <ActionIcon variant="subtle" aria-label="Edit" onClick={() => setEditing(f)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Group>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No facilities yet.</Text>}
      </Stack>
      {editing && <FacilityModal facility={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

function FacilityModal({ facility, onClose }: { facility: Facility; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(facility.name);
  const [active, setActive] = useState(facility.is_active);
  useEffect(() => { setName(facility.name); setActive(facility.is_active); }, [facility]);
  const done = () => { qc.invalidateQueries({ queryKey: ["facilities"] }); onClose(); };

  const saveM = useMutation({
    mutationFn: () => api.patch(`/facilities/${facility.id}`, { name: name.trim(), is_active: active }),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => api.del(`/facilities/${facility.id}`),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title="Edit facility">
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Switch label="Active" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
        <Group justify="space-between" mt="sm">
          <Button variant="light" color="red" loading={delM.isPending} onClick={() => delM.mutate()}>Delete</Button>
          <Button loading={saveM.isPending} disabled={!name.trim()} onClick={() => saveM.mutate()}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
