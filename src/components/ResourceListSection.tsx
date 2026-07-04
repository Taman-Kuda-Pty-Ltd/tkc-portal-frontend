import { ActionIcon, Button, Group, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";

interface ResourceItem {
  id: number;
  name: string;
  is_active: boolean;
}

/** Generic manager for a simple name+active list (facilities, horses, students). */
export function ResourceListSection({
  path,
  addPlaceholder,
}: {
  path: string;
  addPlaceholder: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: [path], queryFn: () => api.get<ResourceItem[]>(`/${path}`) });

  const addM = useMutation({
    mutationFn: () => api.post(`/${path}`, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [path] });
      setName("");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="sm">
      <Group align="flex-end">
        <TextInput placeholder={addPlaceholder} value={name} style={{ flex: 1 }}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && addM.mutate()} />
        <Button loading={addM.isPending} disabled={!name.trim()} onClick={() => addM.mutate()}>
          Add
        </Button>
      </Group>
      <Stack gap={4}>
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">None yet.</Text>}
        {(q.data ?? []).map((item) => (
          <ResourceRow key={item.id} path={path} item={item} />
        ))}
      </Stack>
    </Stack>
  );
}

function ResourceRow({ path, item }: { path: string; item: ResourceItem }) {
  const qc = useQueryClient();
  const [name, setName] = useState(item.name);
  const patchM = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/${path}/${item.id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [path] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => api.del(`/${path}/${item.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [path] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput style={{ flex: 1 }} value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onBlur={() => name.trim() && name !== item.name && patchM.mutate({ name: name.trim() })} />
      <Switch label="Active" checked={item.is_active}
        onChange={(e) => patchM.mutate({ is_active: e.currentTarget.checked })} />
      <ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={() => delM.mutate()}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}
