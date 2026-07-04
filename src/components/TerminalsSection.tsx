import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCheck, IconCopy, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";

interface Terminal {
  id: number;
  name: string;
  terminal_type: "checkin" | "schedule";
  token: string;
  is_active: boolean;
}

const TYPE_LABEL: Record<string, string> = { checkin: "Staff check-in", schedule: "Schedule display" };

export function TerminalsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("checkin");

  const q = useQuery({ queryKey: ["terminals"], queryFn: () => api.get<Terminal[]>("/terminals") });

  const createM = useMutation({
    mutationFn: () => api.post<Terminal>("/terminals", { name, terminal_type: type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      setName("");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const patchM = useMutation({
    mutationFn: (v: { id: number; is_active: boolean }) =>
      api.patch(`/terminals/${v.id}`, { is_active: v.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terminals"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/terminals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terminals"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const setupUrl = (t: Terminal) => `${window.location.origin}/terminal?token=${t.token}`;

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Register a kiosk device, then open its <b>Setup link</b> once on that device.
        The device is locked to its terminal type; staff use their PIN to check in.
      </Text>

      <Group align="flex-end">
        <TextInput label="Device name" placeholder="e.g. Barn iPad" value={name}
          onChange={(e) => setName(e.currentTarget.value)} style={{ flex: 1 }} />
        <Select label="Type" data={[
          { value: "checkin", label: "Staff check-in" },
          { value: "schedule", label: "Schedule display" },
        ]} value={type} onChange={(v) => setType(v || "checkin")} allowDeselect={false} w={200} />
        <Button loading={createM.isPending} disabled={!name.trim()} onClick={() => createM.mutate()}>
          Register
        </Button>
      </Group>

      <Stack gap="sm">
        {(q.data ?? []).map((t) => (
          <Card key={t.id} withBorder>
            <Group justify="space-between" wrap="wrap">
              <div>
                <Group gap="xs">
                  <Text fw={600}>{t.name}</Text>
                  <Badge variant="light">{TYPE_LABEL[t.terminal_type]}</Badge>
                  <Badge variant="light" color={t.is_active ? "teal" : "gray"}>
                    {t.is_active ? "Active" : "Disabled"}
                  </Badge>
                </Group>
              </div>
              <Group gap="xs">
                <CopyButton value={setupUrl(t)}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="light" leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}>
                      {copied ? "Copied" : "Copy setup link"}
                    </Button>
                  )}
                </CopyButton>
                <Switch label="Active" checked={t.is_active}
                  onChange={(e) => patchM.mutate({ id: t.id, is_active: e.currentTarget.checked })} />
                <ActionIcon color="red" variant="subtle" aria-label="Delete"
                  onClick={() => delM.mutate(t.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No terminals registered yet.</Text>}
      </Stack>
    </Stack>
  );
}
