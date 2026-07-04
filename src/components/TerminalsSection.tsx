import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCheck, IconCopy, IconSettings } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Terminal {
  id: number;
  name: string;
  terminal_type: "checkin" | "schedule";
  token: string;
  is_active: boolean;
  inactivity_seconds: number;
}

const TYPE_LABEL: Record<string, string> = { checkin: "Staff check-in", schedule: "Schedule display" };

export function TerminalsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("checkin");
  const [settingsFor, setSettingsFor] = useState<Terminal | null>(null);

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
                <ActionIcon variant="subtle" aria-label="Settings" onClick={() => setSettingsFor(t)}>
                  <IconSettings size={18} />
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No terminals registered yet.</Text>}
      </Stack>

      {settingsFor && (
        <TerminalSettingsModal terminal={settingsFor} onClose={() => setSettingsFor(null)} />
      )}
    </Stack>
  );
}

function TerminalSettingsModal({ terminal, onClose }: { terminal: Terminal; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(terminal.name);
  const [inactivity, setInactivity] = useState<number>(terminal.inactivity_seconds);
  useEffect(() => {
    setName(terminal.name);
    setInactivity(terminal.inactivity_seconds);
  }, [terminal]);

  const saveM = useMutation({
    mutationFn: () =>
      api.patch(`/terminals/${terminal.id}`, { name: name.trim(), inactivity_seconds: inactivity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => api.del(`/terminals/${terminal.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title={`${terminal.name} settings`}>
      <Stack>
        <TextInput label="Device name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <NumberInput label="Auto sign-out after (seconds idle)"
          description="Returns to the name-select screen. 0 = never."
          min={0} step={30} value={inactivity} onChange={(v) => setInactivity(Number(v) || 0)} />
        <Group justify="space-between" mt="sm">
          <Button variant="light" color="red" loading={delM.isPending}
            onClick={() => delM.mutate()}>
            Delete terminal
          </Button>
          <Button loading={saveM.isPending} disabled={!name.trim()} onClick={() => saveM.mutate()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
