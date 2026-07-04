import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
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

const AVATAR_COLORS = ["teal", "blue", "grape", "orange", "cyan", "pink", "indigo", "lime"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  let sum = 0;
  for (const c of name) sum += c.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

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
        <Box
          style={{
            display: "grid",
            gap: "var(--mantine-spacing-lg)",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {(rosterQ.data ?? []).map((p) => (
            <Card
              key={p.id}
              withBorder
              padding="lg"
              onClick={() => setPinFor(p)}
              style={{ cursor: "pointer" }}
            >
              <Group gap="md" wrap="nowrap">
                <Avatar radius="xl" size={56} color={avatarColor(p.display_name)}>
                  {initials(p.display_name)}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={700} size="lg" lineClamp={2}>{p.display_name}</Text>
                  <Group gap={6} mt={4}>
                    <Badge size="lg" color={STATUS[p.status].color} variant="light">
                      {STATUS[p.status].label}
                    </Badge>
                    {!p.has_shift && <Badge size="lg" color="gray" variant="outline">No shift</Badge>}
                  </Group>
                </div>
              </Group>
            </Card>
          ))}
        </Box>
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
        <Button fullWidth size="lg" loading={busy} disabled={pin.length < 6} onClick={submit}>
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
      {session.shifts.length === 0 && session.lessons.length === 0 && (
        <Card withBorder padding="xl">
          <Text size="lg">You have no shift scheduled today.</Text>
        </Card>
      )}
      {session.shifts.map((s) => (
        <ShiftCheckCard key={s.shift_id} shift={s} personId={session.person_id} pin={pin} onRefresh={onRefresh} />
      ))}
      {session.lessons.length > 0 && (
        <CoachingSection
          key={session.coaching_attendance?.status ?? "none"}
          session={session}
          pin={pin}
          onRefresh={onRefresh}
        />
      )}
      <AdhocTaskCard personId={session.person_id} pin={pin} onRefresh={onRefresh} />
      <ChangePinControl personId={session.person_id} pin={pin} />
    </Stack>
  );
}

function ChangePinControl({ personId, pin }: { personId: number; pin: string }) {
  const [open, setOpen] = useState(false);
  const [np, setNp] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  async function submit() {
    if (np !== confirm) return setError("The PINs don't match.");
    setBusy(true);
    setError(null);
    try {
      await terminalApi.changePin(personId, pin, np);
      setOpen(false);
      setNp("");
      setConfirm("");
      setOk(true);
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Group justify="center">
        {ok && <Text c="teal">PIN updated.</Text>}
        <Button variant="subtle" size="md" onClick={() => { setOk(false); setOpen(true); }}>
          Change my PIN
        </Button>
      </Group>
    );
  }
  return (
    <Card withBorder padding="lg">
      <Stack>
        <Text fw={700} size="lg">Change my PIN</Text>
        <PasswordInput label="New PIN (6–8 digits)" inputMode="numeric" size="lg" value={np}
          onChange={(e) => setNp(digits(e.currentTarget.value))} />
        <PasswordInput label="Confirm new PIN" inputMode="numeric" size="lg" value={confirm}
          onChange={(e) => setConfirm(digits(e.currentTarget.value))} />
        {error && <Text c="red">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" size="lg" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="lg" loading={busy} disabled={np.length < 6 || np !== confirm} onClick={submit}>
            Update PIN
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function AdhocTaskCard({
  personId,
  pin,
  onRefresh,
}: {
  personId: number;
  pin: string;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actQ = useQuery({
    queryKey: ["terminal-activities"],
    queryFn: () => terminalApi.activities(),
    enabled: open,
  });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await terminalApi.adhocCheckIn(personId, pin, Number(activityId), title.trim());
      setOpen(false);
      setActivityId(null);
      setTitle("");
      await onRefresh();
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="light" size="lg" leftSection={<IconPlus size={18} />} onClick={() => setOpen(true)}>
        Log an extra task
      </Button>
    );
  }
  return (
    <Card withBorder padding="lg">
      <Stack>
        <Text fw={700} size="lg">Log an extra task</Text>
        <Text size="sm" c="dimmed">A manager will review it before it counts for hours.</Text>
        <Select label="Type of work" placeholder="Choose"
          data={(actQ.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
          value={activityId} onChange={setActivityId} size="lg" comboboxProps={{ withinPortal: true }} />
        <TextInput label="What are you doing?" value={title} size="lg"
          onChange={(e) => setTitle(e.currentTarget.value)} />
        {error && <Text c="red">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" size="lg" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="lg" loading={busy} disabled={!activityId || !title.trim()} onClick={submit}>
            Log &amp; check in
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function CoachingSection({
  session,
  pin,
  onRefresh,
}: {
  session: TerminalSession;
  pin: string;
  onRefresh: () => Promise<void>;
}) {
  const coaching = session.coaching_attendance;
  const [state, setState] = useState<Record<number, { completed: boolean; notes: string }>>(
    Object.fromEntries(session.lessons.map((l) => [l.shift_id, { completed: l.completed, notes: "" }])),
  );
  const [busy, setBusy] = useState(false);
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

  const checkedIn = coaching?.status === "checked_in";
  const done = coaching?.status === "checked_out";

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={700} size="xl">Coaching — today's lessons</Text>
        {checkedIn && <Badge size="lg" color="teal">On site</Badge>}
        {done && <Badge size="lg" color="blue">Left</Badge>}
      </Group>

      <Stack gap="sm">
        {session.lessons.map((l) => (
          <Card key={l.shift_id} withBorder radius="sm" bg="var(--mantine-color-default)">
            <Group justify="space-between" wrap="wrap">
              <Text fw={600} size="lg">
                {dayjs(l.starts_at).format("HH:mm")}–{dayjs(l.ends_at).format("HH:mm")}
                {l.facility_name ? ` · ${l.facility_name}` : ""}
              </Text>
              {done && l.completed && <Badge color="teal">Done</Badge>}
            </Group>
            {l.riders.length > 0 && (
              <Text c="dimmed" mt={2}>{l.riders.join(", ")}</Text>
            )}
            {checkedIn && (
              <Stack gap="xs" mt="sm">
                <Checkbox
                  size="md"
                  label="Lesson completed"
                  checked={state[l.shift_id]?.completed ?? false}
                  onChange={(e) =>
                    setState((s) => ({ ...s, [l.shift_id]: { ...s[l.shift_id], completed: e.currentTarget.checked } }))
                  }
                />
                <Textarea
                  placeholder="Horse / training notes (optional)"
                  value={state[l.shift_id]?.notes ?? ""}
                  autosize
                  minRows={1}
                  onChange={(e) =>
                    setState((s) => ({ ...s, [l.shift_id]: { ...s[l.shift_id], notes: e.currentTarget.value } }))
                  }
                />
              </Stack>
            )}
          </Card>
        ))}
      </Stack>

      {error && <Text c="red" mt="sm">{error}</Text>}

      {!coaching && (
        <Button mt="md" size="xl" fullWidth loading={busy}
          onClick={() => run(() => terminalApi.coachCheckIn(session.person_id, pin))}>
          Check in for coaching
        </Button>
      )}
      {checkedIn && (
        <Button mt="md" size="xl" fullWidth color="orange" loading={busy}
          onClick={() =>
            run(() =>
              terminalApi.coachCheckOut(
                session.person_id,
                pin,
                session.lessons.map((l) => ({
                  shift_id: l.shift_id,
                  completed: state[l.shift_id]?.completed ?? false,
                  notes: state[l.shift_id]?.notes?.trim() || null,
                })),
              ),
            )
          }>
          Check out
        </Button>
      )}
      {done && (
        <Text mt="md" size="lg">
          Checked out at <b>{dayjs(coaching!.checked_out_at!).format("HH:mm")}</b>
          {coaching!.hours_worked != null ? ` · ${coaching!.hours_worked}h recorded` : ""}.
        </Text>
      )}
    </Card>
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
  const adhoc = shift.is_adhoc;
  const plannedH = dayjs(shift.ends_at).diff(dayjs(shift.starts_at), "minute") / 60;
  const planned = Math.round(plannedH * 4) / 4;
  const elapsedH = att
    ? Math.max(0, Math.round((dayjs().diff(dayjs(att.checked_in_at), "minute") / 60) * 4) / 4)
    : planned;
  const [hours, setHours] = useState<number>(planned);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variance = !adhoc && Math.abs(hours - planned) > 0.001;

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
            {dayjs(shift.starts_at).format("HH:mm")}
            {adhoc ? "" : `–${dayjs(shift.ends_at).format("HH:mm")}`}
            {shift.activity_name ? ` · ${shift.activity_name}` : ""}
            {adhoc ? " · extra task" : ` · planned ${plannedH}h`}
          </Text>
        </div>
        <Group gap="xs">
          {adhoc && <Badge size="lg" color="yellow" variant="light">Pending approval</Badge>}
          {att?.status === "checked_in" && <Badge size="lg" color="teal">On site</Badge>}
          {att?.status === "checked_out" && <Badge size="lg" color="blue">Left</Badge>}
        </Group>
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
            <Button size="xl" color="orange" onClick={() => { setHours(adhoc ? elapsedH : planned); setNotes(""); setCheckingOut(true); }}>
              Check out
            </Button>
          ) : (
            <>
              <NumberInput label={adhoc ? "Hours worked" : `Hours worked (planned ${planned}h)`}
                min={0} step={0.25} value={hours}
                onChange={(v) => setHours(Number(v) || 0)} size="lg" />
              <Textarea
                label={variance
                  ? `Reason for ${hours < planned ? "shorter" : "longer"} shift (required)`
                  : "Notes (optional)"}
                value={notes} minRows={2} autosize size="lg"
                onChange={(e) => setNotes(e.currentTarget.value)}
              />
              <Button size="xl" color="orange" loading={busy}
                disabled={variance && !notes.trim()}
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
