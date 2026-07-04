import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { RichTextView } from "../components/RichText";
import {
  terminalApi,
  TerminalError,
  type RosterPerson,
  type ShiftBrief,
  type TerminalSession,
} from "./terminalApi";

const STATUS = {
  off: { label: "Off", color: "gray" },
  checked_in: { label: "On site", color: "teal" },
  checked_out: { label: "Left", color: "blue" },
} as const;

export function CheckInTerminal({ name }: { name: string }) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [pin, setPin] = useState("");
  const [pinFor, setPinFor] = useState<RosterPerson | null>(null);

  const rosterQ = useQuery({
    queryKey: ["terminal-roster"],
    queryFn: () => terminalApi.roster(),
    refetchInterval: 15000,
  });

  function reset() {
    setSession(null);
    setPin("");
    setPinFor(null);
  }

  if (session) {
    return (
      <PersonView
        session={session}
        pin={pin}
        onRefresh={async () => setSession(await terminalApi.session(session.person_id, pin))}
        onDone={() => {
          reset();
          rosterQ.refetch();
        }}
      />
    );
  }

  if (pinFor) {
    return (
      <PinPad
        person={pinFor}
        onCancel={reset}
        onSubmit={async (entered) => {
          const s = await terminalApi.session(pinFor.id, entered);
          setPin(entered);
          setSession(s);
        }}
      />
    );
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between">
        <Title order={2}>{name}</Title>
        <Text c="dimmed">{dayjs().format("dddd D MMMM")}</Text>
      </Group>
      <Text size="lg" c="dimmed">Tap your name to check in or out.</Text>
      {rosterQ.isLoading ? (
        <Center h="50vh"><Loader /></Center>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          {(rosterQ.data ?? []).map((p) => (
            <Card
              key={p.id}
              withBorder
              padding="lg"
              onClick={() => setPinFor(p)}
              style={{ cursor: "pointer", minHeight: 96 }}
            >
              <Text fw={700} size="lg" lineClamp={2}>{p.display_name}</Text>
              <Group gap={6} mt="sm">
                <Badge size="lg" color={STATUS[p.status].color} variant="light">
                  {STATUS[p.status].label}
                </Badge>
                {!p.has_shift && <Badge size="lg" color="gray" variant="outline">No shift</Badge>}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function PinPad({
  person,
  onSubmit,
  onCancel,
}: {
  person: RosterPerson;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  return (
    <Center h="100vh">
      <Stack align="center" gap="lg" w={340}>
        <Title order={2}>{person.display_name}</Title>
        <Text c="dimmed">Enter your PIN</Text>
        <Text size="32px" style={{ letterSpacing: 8, minHeight: 40 }}>
          {"•".repeat(pin.length) || " "}
        </Text>
        {error && <Text c="red">{error}</Text>}
        <SimpleGrid cols={3} spacing="md" w="100%">
          {keys.map((k) => (
            <Button
              key={k}
              variant={k === "clear" || k === "back" ? "light" : "default"}
              size="xl"
              h={64}
              disabled={busy}
              onClick={() => {
                if (k === "clear") setPin("");
                else if (k === "back") setPin((p) => p.slice(0, -1));
                else setPin((p) => (p.length < 8 ? p + k : p));
              }}
            >
              {k === "clear" ? "C" : k === "back" ? "⌫" : k}
            </Button>
          ))}
        </SimpleGrid>
        <Button fullWidth size="lg" loading={busy} disabled={pin.length < 4} onClick={submit}>
          Enter
        </Button>
        <Button fullWidth variant="subtle" onClick={onCancel} disabled={busy}>Cancel</Button>
      </Stack>
    </Center>
  );
}

function PersonView({
  session,
  pin,
  onRefresh,
  onDone,
}: {
  session: TerminalSession;
  pin: string;
  onRefresh: () => Promise<void>;
  onDone: () => void;
}) {
  return (
    <Stack p="xl" gap="lg" maw={720} mx="auto">
      <Group justify="space-between">
        <Title order={2}>Hi, {session.display_name}</Title>
        <Button variant="light" size="lg" leftSection={<IconArrowLeft size={18} />} onClick={onDone}>
          Done
        </Button>
      </Group>
      {session.shifts.length === 0 && (
        <Card withBorder padding="xl">
          <Text size="lg">You have no shift scheduled today.</Text>
        </Card>
      )}
      {session.shifts.map((s) => (
        <ShiftCheckCard key={s.shift_id} shift={s} personId={session.person_id} pin={pin} onRefresh={onRefresh} />
      ))}
    </Stack>
  );
}

function ShiftCheckCard({
  shift,
  personId,
  pin,
  onRefresh,
}: {
  shift: ShiftBrief;
  personId: number;
  pin: string;
  onRefresh: () => Promise<void>;
}) {
  const att = shift.attendance;
  const plannedH = dayjs(shift.ends_at).diff(dayjs(shift.starts_at), "minute") / 60;
  const elapsedH = att
    ? Math.max(0, Math.round((dayjs().diff(dayjs(att.checked_in_at), "minute") / 60) * 4) / 4)
    : plannedH;
  const [hours, setHours] = useState<number>(Math.round(plannedH * 4) / 4);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={700} size="xl">{shift.title || shift.activity_name || "Shift"}</Text>
          <Text c="dimmed">
            {dayjs(shift.starts_at).format("HH:mm")}–{dayjs(shift.ends_at).format("HH:mm")}
            {shift.activity_name ? ` · ${shift.activity_name}` : ""} · planned {plannedH}h
          </Text>
        </div>
        {att?.status === "checked_in" && <Badge size="lg" color="teal">On site</Badge>}
        {att?.status === "checked_out" && <Badge size="lg" color="blue">Left</Badge>}
      </Group>

      {shift.description && (
        <Box mt="sm"><RichTextView html={shift.description} /></Box>
      )}
      {shift.coworkers.length > 0 && (
        <Text c="dimmed" mt="xs">With: {shift.coworkers.join(", ")}</Text>
      )}

      {error && <Text c="red" mt="sm">{error}</Text>}

      {/* Not yet checked in */}
      {!att && (
        <Button mt="md" size="xl" fullWidth loading={busy}
          onClick={() => run(() => terminalApi.checkIn(personId, pin, shift.shift_id))}>
          Check in
        </Button>
      )}

      {/* Checked in — offer check-out */}
      {att?.status === "checked_in" && (
        <Stack mt="md">
          <Text>Checked in at <b>{dayjs(att.checked_in_at).format("HH:mm")}</b>.</Text>
          {!checkingOut ? (
            <Button size="xl" color="orange" onClick={() => { setHours(elapsedH); setCheckingOut(true); }}>
              Check out
            </Button>
          ) : (
            <>
              <NumberInput label="Hours worked" min={0} step={0.25} value={hours}
                onChange={(v) => setHours(Number(v) || 0)} size="lg" />
              <Textarea label="Notes (optional)" value={notes} minRows={2} autosize size="lg"
                onChange={(e) => setNotes(e.currentTarget.value)} />
              <Button size="xl" color="orange" loading={busy}
                onClick={() => run(() => terminalApi.checkOut(personId, pin, shift.shift_id, hours, notes || null))}>
                Confirm check out
              </Button>
            </>
          )}
        </Stack>
      )}

      {/* Done */}
      {att?.status === "checked_out" && (
        <Text mt="md" size="lg">
          Checked out at <b>{dayjs(att.checked_out_at!).format("HH:mm")}</b>
          {att.hours_worked != null ? ` · ${att.hours_worked}h recorded` : ""}.
        </Text>
      )}
    </Card>
  );
}
