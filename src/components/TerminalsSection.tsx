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
import { IconCheck, IconCopy, IconDeviceMobile, IconSettings } from "@tabler/icons-react";
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
  last_seen_at: string | null;
  alert_when_offline: boolean;
}

const TYPE_LABEL: Record<string, string> = { checkin: "Staff check-in", schedule: "Schedule display" };

// last_seen_at is naive UTC — append Z to parse as UTC.
const seenMs = (t: { last_seen_at: string | null }) =>
  t.last_seen_at ? Date.parse(t.last_seen_at + "Z") : null;
export function terminalOnline(t: { last_seen_at: string | null }): boolean {
  const ms = seenMs(t);
  return ms != null && Date.now() - ms < 120_000; // ~2× the slowest poll (60s)
}
function seenLabel(t: Terminal): string {
  const ms = seenMs(t);
  if (ms == null) return "never seen";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function TerminalsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("checkin");
  const [settingsFor, setSettingsFor] = useState<Terminal | null>(null);
  const [setupFor, setSetupFor] = useState<Terminal | null>(null);

  const q = useQuery({
    queryKey: ["terminals"],
    queryFn: () => api.get<Terminal[]>("/terminals"),
    refetchInterval: 30000, // keep the online status fresh
  });

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
        Register a kiosk device, then provision it: open <b>/terminal</b> on the device
        and enter a one-time <b>setup code</b> from “Set up device”. The device then
        remembers itself. The old <b>Setup link</b> still works as a fallback. Each
        device is locked to its terminal type; staff use their PIN to check in.
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
                  <div title={terminalOnline(t) ? "Online" : "Offline"}
                    style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: terminalOnline(t) ? "var(--mantine-color-teal-6)" : "var(--mantine-color-gray-5)",
                      boxShadow: terminalOnline(t) ? "0 0 0 3px var(--mantine-color-teal-1)" : undefined,
                    }} />
                  <Text fw={600}>{t.name}</Text>
                  <Badge variant="light">{TYPE_LABEL[t.terminal_type]}</Badge>
                  {!t.is_active && <Badge variant="light" color="gray">Disabled</Badge>}
                  {t.alert_when_offline && !terminalOnline(t) && t.is_active && (
                    <Badge variant="light" color="orange">Offline</Badge>
                  )}
                </Group>
                <Text size="xs" c={terminalOnline(t) ? "teal" : "dimmed"} mt={2}>
                  {terminalOnline(t) ? "Online" : "Offline"} · last seen {seenLabel(t)}
                </Text>
              </div>
              <Group gap="xs">
                <Button size="xs" variant="light" leftSection={<IconDeviceMobile size={14} />}
                  onClick={() => setSetupFor(t)}>
                  Set up device
                </Button>
                <CopyButton value={setupUrl(t)}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="subtle" leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
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
      {setupFor && (
        <SetupCodeModal terminal={setupFor} onClose={() => setSetupFor(null)} />
      )}
    </Stack>
  );
}

function SetupCodeModal({ terminal, onClose }: { terminal: Terminal; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const gen = useMutation({
    mutationFn: () => api.post<{ code: string; expires_at: string; terminal_id: number }>(
      `/terminals/${terminal.id}/setup-code`,
    ),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  // Mint a code on open.
  useEffect(() => {
    gen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = gen.data?.code;
  const expiresMs = gen.data ? Date.parse(gen.data.expires_at) : null;
  const secsLeft = expiresMs ? Math.max(0, Math.floor((expiresMs - now) / 1000)) : null;
  const expired = secsLeft === 0;

  return (
    <Modal opened onClose={onClose} title={`Set up ${terminal.name}`} centered>
      <Stack align="center">
        <Text size="sm" c="dimmed" ta="center">
          On the device, open <b>/terminal</b> and enter this code to link it. The code
          is single-use and expires shortly.
        </Text>
        {gen.isPending && !code ? (
          <Text c="dimmed">Generating…</Text>
        ) : code ? (
          <>
            <Text fz={48} fw={800} style={{ letterSpacing: 8, opacity: expired ? 0.4 : 1 }}>
              {code}
            </Text>
            <Text size="sm" c={expired ? "red" : "dimmed"}>
              {expired
                ? "Expired — generate a new one."
                : `Expires in ${Math.floor((secsLeft ?? 0) / 60)}:${String((secsLeft ?? 0) % 60).padStart(2, "0")}`}
            </Text>
          </>
        ) : (
          <Text c="red">Couldn't generate a code.</Text>
        )}
        <Group justify="space-between" w="100%">
          <Button variant="light" loading={gen.isPending} onClick={() => gen.mutate()}>
            {expired ? "Generate new code" : "Regenerate"}
          </Button>
          <Button variant="default" onClick={onClose}>Done</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function TerminalSettingsModal({ terminal, onClose }: { terminal: Terminal; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(terminal.name);
  const [inactivity, setInactivity] = useState<number>(terminal.inactivity_seconds);
  const [alertOffline, setAlertOffline] = useState<boolean>(terminal.alert_when_offline);
  useEffect(() => {
    setName(terminal.name);
    setInactivity(terminal.inactivity_seconds);
    setAlertOffline(terminal.alert_when_offline);
  }, [terminal]);

  const saveM = useMutation({
    mutationFn: () =>
      api.patch(`/terminals/${terminal.id}`, {
        name: name.trim(), inactivity_seconds: inactivity, alert_when_offline: alertOffline,
      }),
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
        <Switch label="Alert me if this device goes offline"
          description="Counts toward the Terminals nav badge when it stops checking in."
          checked={alertOffline} onChange={(e) => setAlertOffline(e.currentTarget.checked)} />
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
