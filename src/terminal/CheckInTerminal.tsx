import {
  ActionIcon,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconUsers, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { RichTextView } from "../components/RichText";
import { WeatherStrip } from "./WeatherStrip";
import { dateInBusinessTz, fmtTime, nowInBusinessTz, type TimeFormat } from "./timeFormat";
import {
  terminalApi,
  TerminalError,
  type CoverableShift,
  type LessonClash,
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

/** A clock that ticks every `everyMs` so time-gated UI (the check-out window)
 *  updates itself without a full session refresh. */
function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Large live clock + date in the club's business timezone, 24h/12h per setting.
 *  Ticks internally so the rest of the terminal isn't re-rendered every second. */
function TerminalClock({ tz, format }: { tz: string; format: TimeFormat }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Stack gap={0} align="flex-end">
      <Text fz={44} fw={800} lh={1} style={{ fontVariantNumeric: "tabular-nums" }}>
        {nowInBusinessTz(tz, format, now)}
      </Text>
      <Text c="dimmed">{dateInBusinessTz(tz, now)}</Text>
    </Stack>
  );
}

export function CheckInTerminal({
  name,
  inactivitySeconds,
  minHours,
  checkoutWindowMinutes,
  timeFormat,
  businessTimezone,
}: {
  name: string;
  inactivitySeconds: number;
  minHours: number;
  checkoutWindowMinutes: number;
  timeFormat: TimeFormat;
  businessTimezone: string;
}) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [pin, setPin] = useState("");
  const [pinFor, setPinFor] = useState<RosterPerson | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const rosterQ = useQuery({
    queryKey: ["terminal-roster"],
    queryFn: () => terminalApi.roster(),
    refetchInterval: 15000,
  });

  function reset() {
    setSession(null);
    setPin("");
    setPinFor(null);
    setShowOthers(false);
  }

  // Auto sign-out to the name-select screen after inactivity (0 = never).
  useEffect(() => {
    if (inactivitySeconds <= 0 || (!session && !pinFor)) return;
    let timer: number;
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reset, inactivitySeconds * 1000);
    };
    bump();
    const events = ["mousedown", "keydown", "touchstart", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, bump));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [session, pinFor, inactivitySeconds]);

  if (session) {
    return (
      <PersonView
        session={session}
        pin={pin}
        minHours={minHours}
        checkoutWindowMinutes={checkoutWindowMinutes}
        timeFormat={timeFormat}
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

  const roster = rosterQ.data ?? [];
  // Big tap cards for people actually on today; everyone else is behind "Someone else".
  const onToday = roster.filter((p) => p.has_shift || p.status !== "off");
  const others = roster.filter((p) => !p.has_shift && p.status === "off");

  return (
    <Box style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Stack p="xl" gap="lg" style={{ flex: 1 }}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{name}</Title>
          <Text size="lg" c="dimmed">Tap your name to check in or out.</Text>
        </div>
        <TerminalClock tz={businessTimezone} format={timeFormat} />
      </Group>

      {rosterQ.isLoading ? (
        <Center h="50vh"><Loader /></Center>
      ) : (
        <Stack align="center" gap="lg" style={{ flex: 1 }}>
          <Box
            style={{
              display: "grid",
              gap: "var(--mantine-spacing-lg)",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 300px))",
              justifyContent: "center",
              width: "100%",
              maxWidth: 980,
            }}
          >
            {onToday.map((p) => (
              <RosterCard key={p.id} person={p} onTap={() => setPinFor(p)} />
            ))}
            {onToday.length === 0 && (
              <Text c="dimmed" size="lg" ta="center" style={{ gridColumn: "1 / -1" }}>
                Nobody is rostered on today.
              </Text>
            )}
          </Box>

          {others.length > 0 && !showOthers && (
            <Button variant="light" size="lg" leftSection={<IconUsers size={20} />}
              onClick={() => setShowOthers(true)}>
              Someone else
            </Button>
          )}
          {showOthers && (
            <Card withBorder padding="lg" w="100%" maw={460}>
              <Group justify="space-between" mb="sm">
                <Text fw={700} size="lg">Someone else</Text>
                <Button variant="subtle" size="sm" onClick={() => setShowOthers(false)}>Hide</Button>
              </Group>
              <Box style={{ maxHeight: "50vh", overflowY: "auto" }}>
                <Stack gap="xs">
                  {others.map((p) => (
                    <Button key={p.id} variant="default" size="lg" justify="flex-start"
                      leftSection={
                        <Avatar radius="xl" size={36} color={avatarColor(p.display_name)}>
                          {initials(p.display_name)}
                        </Avatar>
                      }
                      onClick={() => setPinFor(p)}>
                      {p.display_name}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Card>
          )}
        </Stack>
      )}
      </Stack>
      <WeatherStrip timeFormat={timeFormat} />
    </Box>
  );
}

function RosterCard({ person, onTap }: { person: RosterPerson; onTap: () => void }) {
  return (
    <Card withBorder padding="lg" onClick={onTap} style={{ cursor: "pointer" }}>
      <Group gap="md" wrap="nowrap">
        <Avatar radius="xl" size={56} color={avatarColor(person.display_name)}>
          {initials(person.display_name)}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="lg" lineClamp={2}>{person.display_name}</Text>
          <Group gap={6} mt={4}>
            <Badge size="lg" color={STATUS[person.status].color} variant="light">
              {STATUS[person.status].label}
            </Badge>
            {!person.has_shift && <Badge size="lg" color="gray" variant="outline">No shift</Badge>}
          </Group>
        </div>
      </Group>
    </Card>
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
  minHours,
  checkoutWindowMinutes,
  timeFormat,
  onRefresh,
  onDone,
}: {
  session: TerminalSession;
  pin: string;
  minHours: number;
  checkoutWindowMinutes: number;
  timeFormat: TimeFormat;
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
        <ShiftCheckCard key={s.shift_id} shift={s} personId={session.person_id} pin={pin}
          minHours={minHours} checkoutWindowMinutes={checkoutWindowMinutes}
          timeFormat={timeFormat} onRefresh={onRefresh} />
      ))}
      {session.lessons.length > 0 && (
        <CoachingSection
          key={session.coaching_attendance?.status ?? "none"}
          session={session}
          pin={pin}
          timeFormat={timeFormat}
          onRefresh={onRefresh}
        />
      )}
      <AdhocTaskCard personId={session.person_id} pin={pin} onRefresh={onRefresh} />
      <CoverShiftCard
        personId={session.person_id}
        pin={pin}
        timeFormat={timeFormat}
        onRefresh={onRefresh}
      />
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
  const [riders, setRiders] = useState<{ student_id: string | null; horse_id: string | null }[]>([]);
  const [stage, setStage] = useState<"form" | "confirm">("form");
  const [clashes, setClashes] = useState<LessonClash[]>([]);
  const [decisions, setDecisions] = useState<Record<number, "replace" | "new">>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actQ = useQuery({ queryKey: ["terminal-activities"], queryFn: () => terminalApi.activities(), enabled: open });
  const studentsQ = useQuery({ queryKey: ["terminal-students"], queryFn: () => terminalApi.students(), enabled: open });
  const horsesQ = useQuery({ queryKey: ["terminal-horses"], queryFn: () => terminalApi.horses(), enabled: open });

  const activity = (actQ.data ?? []).find((a) => String(a.id) === activityId);
  const isLesson = !!activity?.is_lesson;
  const studentIds = riders.map((r) => r.student_id).filter(Boolean).map(Number);
  const studentName = (id: number) => (studentsQ.data ?? []).find((s) => s.id === id)?.name ?? "Student";

  function resetAll() {
    setOpen(false); setActivityId(null); setTitle(""); setRiders([]);
    setStage("form"); setClashes([]); setDecisions({}); setReason(""); setError(null);
  }
  const hasReplace = studentIds.some((id) => decisions[id] === "replace");
  const updateRider = (i: number, patch: Partial<{ student_id: string | null; horse_id: string | null }>) =>
    setRiders(riders.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setError(null);
    try { await fn(); after?.(); }
    catch (e) { setError(e instanceof TerminalError ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const submitNonLesson = () =>
    run(() => terminalApi.adhocCheckIn(personId, pin, Number(activityId), title.trim()),
      async () => { resetAll(); await onRefresh(); });

  const continueLesson = () => {
    if (studentIds.length === 0) return setError("Add at least one student.");
    run(async () => {
      const cl = await terminalApi.lessonClashCheck(personId, pin, studentIds);
      setClashes(cl);
      const dec: Record<number, "replace" | "new"> = {};
      studentIds.forEach((id) => (dec[id] = cl.some((c) => c.student_id === id) ? "replace" : "new"));
      setDecisions(dec);
      setStage("confirm");
    });
  };

  const confirmLesson = () =>
    run(() =>
      terminalApi.adhocLessonCheckIn(
        personId, pin, Number(activityId), title.trim(), null,
        riders.filter((r) => r.student_id).map((r) => ({
          student_id: Number(r.student_id), horse_id: r.horse_id ? Number(r.horse_id) : null,
        })),
        studentIds.filter((id) => decisions[id] === "replace"),
        hasReplace ? reason.trim() : null,
      ),
      async () => { resetAll(); await onRefresh(); });

  if (!open) {
    return (
      <Button variant="light" size="lg" leftSection={<IconPlus size={18} />} onClick={() => setOpen(true)}>
        Log an extra task
      </Button>
    );
  }

  if (stage === "confirm") {
    return (
      <Card withBorder padding="lg">
        <Stack>
          <Text fw={700} size="lg">Confirm coaching</Text>
          {studentIds.map((id) => {
            const clash = clashes.find((c) => c.student_id === id);
            return (
              <div key={id}>
                <Text fw={600}>{studentName(id)}</Text>
                {clash ? (
                  <Stack gap={4} mt={4}>
                    <Text size="sm" c="dimmed">
                      Already booked {dayjs(clash.starts_at).format("HH:mm")} with{" "}
                      {clash.coach_name ?? "another coach"}.
                    </Text>
                    <SegmentedControl
                      value={decisions[id]}
                      onChange={(v) => setDecisions((d) => ({ ...d, [id]: v as "replace" | "new" }))}
                      data={[
                        { label: "I'm covering (change of coach)", value: "replace" },
                        { label: "Separate new lesson", value: "new" },
                      ]}
                    />
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">New lesson.</Text>
                )}
              </div>
            );
          })}
          {hasReplace && (
            <Textarea
              label="Reason for covering (required)"
              description="Sent to a manager to approve the coach change."
              value={reason} autosize minRows={2}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
          )}
          {error && <Text c="red">{error}</Text>}
          <Group justify="space-between">
            <Button variant="default" size="lg" onClick={() => setStage("form")}>Back</Button>
            <Button size="lg" loading={busy} disabled={hasReplace && !reason.trim()} onClick={confirmLesson}>
              Confirm &amp; check in
            </Button>
          </Group>
        </Stack>
      </Card>
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
        <TextInput label={isLesson ? "Session name" : "What are you doing?"} value={title} size="lg"
          onChange={(e) => setTitle(e.currentTarget.value)} />

        {isLesson && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>Students</Text>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                onClick={() => setRiders([...riders, { student_id: null, horse_id: null }])}>
                Add student
              </Button>
            </Group>
            <Stack gap="xs">
              {riders.length === 0 && <Text size="sm" c="dimmed">Add the students you're coaching.</Text>}
              {riders.map((r, i) => (
                <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
                  <Select placeholder="Student" searchable style={{ flex: 1 }}
                    data={(studentsQ.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
                    value={r.student_id} onChange={(v) => updateRider(i, { student_id: v })}
                    comboboxProps={{ withinPortal: true }} />
                  <Text c="dimmed" pb={8}>on</Text>
                  <Select placeholder="Horse" searchable clearable style={{ flex: 1 }}
                    data={(horsesQ.data ?? []).map((h) => ({ value: String(h.id), label: h.name }))}
                    value={r.horse_id} onChange={(v) => updateRider(i, { horse_id: v })}
                    comboboxProps={{ withinPortal: true }} />
                  <ActionIcon color="red" variant="subtle" aria-label="Remove"
                    onClick={() => setRiders(riders.filter((_, idx) => idx !== i))}>
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>
        )}

        {error && <Text c="red">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" size="lg" onClick={resetAll}>Cancel</Button>
          {isLesson ? (
            <Button size="lg" loading={busy}
              disabled={!activityId || !title.trim() || riders.every((r) => !r.student_id)}
              onClick={continueLesson}>
              Continue
            </Button>
          ) : (
            <Button size="lg" loading={busy} disabled={!activityId || !title.trim()} onClick={submitNonLesson}>
              Log &amp; check in
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

function CoverShiftCard({
  personId,
  pin,
  timeFormat,
  onRefresh,
}: {
  personId: number;
  pin: string;
  timeFormat: TimeFormat;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CoverableShift | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneFor, setDoneFor] = useState<CoverableShift | null>(null);

  const coverQ = useQuery({
    queryKey: ["terminal-coverable", personId],
    queryFn: () => terminalApi.coverableShifts(personId, pin),
    enabled: open,
  });

  function resetAll() {
    setOpen(false);
    setPicked(null);
    setReason("");
    setError(null);
  }

  async function submit() {
    if (!picked || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await terminalApi.coverCheckIn(personId, pin, picked.shift_id, picked.original_person_id, reason.trim());
      setDoneFor(picked);
      resetAll();
      await onRefresh();
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Stack gap="xs">
        {doneFor && (
          <Text c="teal" ta="center">
            You're now covering {doneFor.title || doneFor.activity_name || "the shift"}
            {doneFor.original_name ? ` for ${doneFor.original_name}` : ""} —{" "}
            {doneFor.is_lesson
              ? "you're checked in for coaching. Record it at check-out to be paid for the lesson."
              : "you're checked in."}
          </Text>
        )}
        <Button variant="light" size="lg" leftSection={<IconUsers size={18} />}
          onClick={() => { setDoneFor(null); setOpen(true); }}>
          Cover a colleague's shift
        </Button>
      </Stack>
    );
  }

  const shifts = coverQ.data ?? [];
  return (
    <Card withBorder padding="lg">
      <Stack>
        <Text fw={700} size="lg">Cover a colleague's shift</Text>
        <Text size="sm" c="dimmed">
          Pick the shift you're covering and say why. You'll be checked in straight away;
          a manager reviews it afterwards. Covering a lesson takes over that coach's slot —
          record it at check-out to be paid for the lesson.
        </Text>

        {coverQ.isLoading ? (
          <Center py="md"><Loader /></Center>
        ) : shifts.length === 0 ? (
          <Text c="dimmed">No other shifts to cover today.</Text>
        ) : (
          <Stack gap="xs">
            {shifts.map((s) => {
              const selected = picked?.shift_id === s.shift_id && picked?.original_person_id === s.original_person_id;
              return (
                <Card
                  key={`${s.shift_id}-${s.original_person_id}`}
                  withBorder
                  radius="md"
                  p="md"
                  onClick={() => !s.already_covered && setPicked(s)}
                  style={{
                    cursor: s.already_covered ? "not-allowed" : "pointer",
                    opacity: s.already_covered ? 0.55 : 1,
                    borderColor: selected ? "var(--mantine-color-teal-6)" : undefined,
                    borderWidth: selected ? 2 : undefined,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={700}>{s.title || s.activity_name || "Shift"}</Text>
                        {s.is_lesson && (
                          <Badge color="violet" variant="light">Lesson · coach cover</Badge>
                        )}
                      </Group>
                      {/* Covered colleague made prominent (UAT#3 COVER-NAME). */}
                      {s.original_name && (
                        <Badge color="orange" variant="filled" mt={4} size="lg" tt="none">
                          Covering for {s.original_name}
                        </Badge>
                      )}
                      <Text size="sm" c="dimmed" mt={4}>
                        {fmtTime(s.starts_at, timeFormat)}–{fmtTime(s.ends_at, timeFormat)}
                      </Text>
                    </div>
                    {s.already_covered && <Badge color="gray" variant="light">Already covered</Badge>}
                    {selected && <Badge color="teal">Selected</Badge>}
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}

        {picked && (
          <Textarea
            label={`Why isn't ${picked.original_name || "the colleague"} doing this shift? (required)`}
            description="Sent to a manager and to the colleague."
            value={reason} autosize minRows={2} size="md"
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        )}

        {error && <Text c="red">{error}</Text>}
        <Group justify="space-between">
          <Button variant="default" size="lg" onClick={resetAll}>Cancel</Button>
          <Button size="lg" loading={busy} disabled={!picked || !reason.trim()} onClick={submit}>
            Check in as cover
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

type NoteRow = {
  id: string;
  kind: "student" | "horse";
  ref_id: number | null;
  subject: string | null;
  body: string;
  flagged: boolean;
  fixed: boolean; // a default row (subject not editable) vs. one the coach added
};
type LessonState = {
  ran: "yes" | "no" | null; // Did you run this lesson?
  notRunReason: string;
  absent: number[];
  type: string;
  earlyReason: string;
  lessonNote: string;
  notes: NoteRow[];
};

function LessonStatusPill({ starts, ends, now }: { starts: string; ends: string; now: number }) {
  const n = dayjs(now);
  if (n.isAfter(dayjs(ends))) return null;
  const live = !n.isBefore(dayjs(starts));
  return (
    <Badge size="lg" variant={live ? "filled" : "light"} color={live ? "teal" : "gray"}>
      {live ? "On now" : "Later"}
    </Badge>
  );
}

function CoachingSection({
  session,
  pin,
  timeFormat,
  onRefresh,
}: {
  session: TerminalSession;
  pin: string;
  timeFormat: TimeFormat;
  onRefresh: () => Promise<void>;
}) {
  const now = useNow();
  const coaching = session.coaching_attendance;

  const initLesson = (l: ShiftBrief): LessonState => {
    const rows: NoteRow[] = [];
    // Single rider → offer one student + one horse note row by default; a multi-
    // student lesson starts empty and uses "＋ Add note".
    if (l.rider_details.length === 1) {
      const rd = l.rider_details[0];
      const [studentName, horseName] = rd.label.split(/ on /);
      rows.push({ id: `s${rd.student_id}`, kind: "student", ref_id: rd.student_id, subject: studentName, body: "", flagged: false, fixed: true });
      if (horseName) rows.push({ id: `h${rd.student_id}`, kind: "horse", ref_id: null, subject: horseName, body: "", flagged: false, fixed: true });
    }
    return {
      ran: l.completed ? "yes" : null,
      notRunReason: "",
      absent: [],
      type: String(l.activity_id),
      earlyReason: "",
      lessonNote: "",
      notes: rows,
    };
  };

  const [state, setState] = useState<Record<number, LessonState>>(
    Object.fromEntries(session.lessons.map((l) => [l.shift_id, initLesson(l)])),
  );
  // Keep a state entry for every current lesson (session can refresh after check-in).
  useEffect(() => {
    setState((s) => {
      const next = { ...s };
      let changed = false;
      for (const l of session.lessons) {
        if (!next[l.shift_id]) {
          next[l.shift_id] = initLesson(l);
          changed = true;
        }
      }
      return changed ? next : s;
    });
  }, [session.lessons]);

  const lessonTypesQ = useQuery({
    queryKey: ["terminal-activities"],
    queryFn: () => terminalApi.activities(),
    enabled: coaching?.status === "checked_in",
  });
  const lessonTypeOptions = (lessonTypesQ.data ?? [])
    .filter((a) => a.is_lesson)
    .map((a) => ({ value: String(a.id), label: a.name }));
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
  const patch = (shiftId: number, p: Partial<LessonState>) =>
    setState((s) => ({ ...s, [shiftId]: { ...s[shiftId], ...p } }));
  const toggleAbsent = (shiftId: number, studentId: number, absent: boolean) =>
    setState((s) => {
      const cur = s[shiftId];
      const set = new Set(cur.absent);
      absent ? set.add(studentId) : set.delete(studentId);
      return { ...s, [shiftId]: { ...cur, absent: [...set] } };
    });
  const setRows = (shiftId: number, rows: NoteRow[]) => patch(shiftId, { notes: rows });

  const checkoutDisabled = session.lessons.some((l) => {
    const st = state[l.shift_id];
    if (!st || st.ran === null) return true; // must answer Did you run this?
    if (st.ran === "no" && !st.notRunReason.trim()) return true; // reason required
    if (st.ran === "yes" && dayjs(now).isBefore(dayjs(l.starts_at)) && !st.earlyReason.trim()) return true;
    return false;
  });

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={700} size="xl">Coaching — today's lessons</Text>
        {checkedIn && <Badge size="lg" color="teal">On site</Badge>}
        {done && <Badge size="lg" color="blue">Left</Badge>}
      </Group>

      <Stack gap="sm">
        {session.lessons.map((l) => {
          const st = state[l.shift_id];
          const studentOptions = l.rider_details.map((r) => ({
            value: String(r.student_id),
            label: r.label.split(/ on /)[0],
          }));
          // Horses assigned to this lesson (from "Student on Horse" labels) — offered
          // as suggestions for horse notes, still free-typeable (UAT#3 HNOTE-DROPDOWN).
          const horseNames = Array.from(new Set(
            l.rider_details.map((r) => (r.label.split(/ on /)[1] ?? "").trim()).filter(Boolean),
          ));
          return (
            <Card key={l.shift_id} withBorder radius="md" p="md" bg="var(--mantine-color-default)">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {l.riders.length > 0 ? (
                    <Group gap={8} mb={6}>
                      {l.riders.map((r, i) => (
                        <Badge key={i} size="lg" variant="light" color="teal"
                          styles={{ label: { textTransform: "none", fontSize: 15 } }}>
                          {r.replace(/ on /, " · ")}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text fw={700} size="lg" mb={6}>{l.title || "Lesson"}</Text>
                  )}
                  <Text fw={700} size="lg">{fmtTime(l.starts_at, timeFormat)}</Text>
                  {l.facility_name && <Text size="sm" c="dimmed">{l.facility_name}</Text>}
                </div>
                <Stack gap={6} align="flex-end">
                  <LessonStatusPill starts={l.starts_at} ends={l.ends_at} now={now} />
                  {done && l.completed && <Badge color="teal">Delivered</Badge>}
                </Stack>
              </Group>

              {checkedIn && st && (
                <Stack gap="sm" mt="md">
                  <div>
                    <Text size="sm" fw={600} mb={4}>Did you run this lesson?</Text>
                    <SegmentedControl
                      value={st.ran ?? ""}
                      onChange={(v) => patch(l.shift_id, { ran: v as "yes" | "no" })}
                      data={[
                        { label: "Yes", value: "yes" },
                        { label: "No / didn't happen", value: "no" },
                      ]}
                    />
                  </div>

                  {st.ran === "no" && (
                    <Textarea
                      label="What happened? (required)"
                      description="A manager will see this."
                      value={st.notRunReason} autosize minRows={2} size="md"
                      onChange={(e) => patch(l.shift_id, { notRunReason: e.currentTarget.value })}
                    />
                  )}

                  {st.ran === "yes" && (
                    <>
                      {dayjs(now).isBefore(dayjs(l.starts_at)) && (
                        <Textarea
                          label="Reason for finishing early (required)"
                          description={`This lesson isn't due to start until ${fmtTime(l.starts_at, timeFormat)}.`}
                          value={st.earlyReason} autosize minRows={2} size="md"
                          onChange={(e) => patch(l.shift_id, { earlyReason: e.currentTarget.value })}
                        />
                      )}
                      {l.rider_details.length > 0 && (
                        <div>
                          <Text size="sm" fw={600} mb={4}>Attendance</Text>
                          {l.rider_details.map((r) => {
                            const absent = st.absent.includes(r.student_id);
                            return (
                              <Group key={r.student_id} justify="space-between" wrap="nowrap" mt={4}>
                                <Text size="sm">{r.label.split(/ on /)[0]}</Text>
                                <SegmentedControl size="xs"
                                  value={absent ? "absent" : "attended"}
                                  onChange={(v) => toggleAbsent(l.shift_id, r.student_id, v === "absent")}
                                  data={[
                                    { label: "Attended", value: "attended" },
                                    { label: "Absent", value: "absent" },
                                  ]}
                                />
                              </Group>
                            );
                          })}
                        </div>
                      )}

                      <Textarea
                        label="Lesson note"
                        placeholder="Overall note on the lesson (optional)"
                        value={st.lessonNote} autosize minRows={1}
                        onChange={(e) => patch(l.shift_id, { lessonNote: e.currentTarget.value })}
                      />

                      {st.notes.map((row, idx) => (
                        <Card key={row.id} withBorder radius="sm" p="sm">
                          <Group justify="space-between" wrap="nowrap" mb={4}>
                            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                              <Badge variant="light" color={row.kind === "horse" ? "orange" : "teal"}>
                                {row.kind === "horse" ? "Horse" : "Student"}
                              </Badge>
                              {row.fixed ? (
                                <Text size="sm" fw={600}>{row.subject}</Text>
                              ) : row.kind === "student" ? (
                                <Select size="xs" placeholder="Student" data={studentOptions}
                                  value={row.ref_id ? String(row.ref_id) : null}
                                  onChange={(v) => {
                                    const opt = studentOptions.find((o) => o.value === v);
                                    const rows = [...st.notes];
                                    rows[idx] = { ...row, ref_id: v ? Number(v) : null, subject: opt?.label ?? null };
                                    setRows(l.shift_id, rows);
                                  }}
                                  comboboxProps={{ withinPortal: true }} style={{ flex: 1 }} />
                              ) : (
                                <Autocomplete size="xs" placeholder="Horse" data={horseNames}
                                  value={row.subject ?? ""}
                                  onChange={(v) => {
                                    const rows = [...st.notes];
                                    rows[idx] = { ...row, subject: v };
                                    setRows(l.shift_id, rows);
                                  }}
                                  comboboxProps={{ withinPortal: true }} style={{ flex: 1 }} />
                              )}
                            </Group>
                            {!row.fixed && (
                              <ActionIcon color="red" variant="subtle" aria-label="Remove note"
                                onClick={() => setRows(l.shift_id, st.notes.filter((_, i) => i !== idx))}>
                                <IconX size={16} />
                              </ActionIcon>
                            )}
                          </Group>
                          <Textarea placeholder="Note" value={row.body} autosize minRows={1}
                            onChange={(e) => {
                              const rows = [...st.notes];
                              rows[idx] = { ...row, body: e.currentTarget.value };
                              setRows(l.shift_id, rows);
                            }} />
                          <Switch mt="xs" size="sm" label="Flag for management"
                            checked={row.flagged}
                            onChange={(e) => {
                              const rows = [...st.notes];
                              rows[idx] = { ...row, flagged: e.currentTarget.checked };
                              setRows(l.shift_id, rows);
                            }} />
                        </Card>
                      ))}

                      <Group gap="xs">
                        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                          onClick={() => setRows(l.shift_id, [
                            ...st.notes,
                            { id: `st${Date.now()}`, kind: "student", ref_id: null, subject: null, body: "", flagged: false, fixed: false },
                          ])}>
                          Student note
                        </Button>
                        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                          onClick={() => setRows(l.shift_id, [
                            ...st.notes,
                            { id: `ho${Date.now()}`, kind: "horse", ref_id: null, subject: null, body: "", flagged: false, fixed: false },
                          ])}>
                          Horse note
                        </Button>
                      </Group>

                      {lessonTypeOptions.length > 0 && (
                        <Select label="Lesson type" description="Change only if it wasn't the booked type — a manager reviews it."
                          data={lessonTypeOptions}
                          value={lessonTypeOptions.some((o) => o.value === st.type) ? st.type : null}
                          onChange={(v) => v && patch(l.shift_id, { type: v })}
                          comboboxProps={{ withinPortal: true }} allowDeselect={false} />
                      )}
                    </>
                  )}
                </Stack>
              )}
            </Card>
          );
        })}
      </Stack>

      {error && <Text c="red" mt="sm">{error}</Text>}

      {!coaching && (
        <Button mt="md" size="xl" fullWidth loading={busy}
          onClick={() => run(() => terminalApi.coachCheckIn(session.person_id, pin))}>
          Check in for coaching
        </Button>
      )}
      {checkedIn && (
        <Button mt="md" size="xl" fullWidth color="orange" loading={busy} disabled={checkoutDisabled}
          onClick={() =>
            run(() =>
              terminalApi.coachCheckOut(
                session.person_id,
                pin,
                session.lessons.map((l) => {
                  const st = state[l.shift_id];
                  const yes = st?.ran === "yes";
                  return {
                    shift_id: l.shift_id,
                    delivered: yes,
                    not_run_reason: st?.ran === "no" ? st.notRunReason.trim() : null,
                    absent_student_ids: yes ? st?.absent ?? [] : [],
                    proposed_activity_id:
                      yes && st?.type && Number(st.type) !== l.activity_id ? Number(st.type) : null,
                    lesson_note: yes ? st?.lessonNote.trim() || null : null,
                    note_items: yes
                      ? (st?.notes ?? [])
                          .filter((n) => n.body.trim())
                          .map((n) => ({
                            kind: n.kind,
                            ref_id: n.ref_id,
                            subject: n.subject,
                            body: n.body.trim(),
                            flagged: n.flagged,
                          }))
                      : [],
                    notes: null,
                    early_reason: yes ? st?.earlyReason.trim() || null : null,
                  };
                }),
              ),
            )
          }>
          Check out
        </Button>
      )}
      {done && (
        <Text mt="md" size="lg">
          Checked out at <b>{fmtTime(coaching!.checked_out_at!, timeFormat)}</b>.
        </Text>
      )}
    </Card>
  );
}

function ShiftCheckCard({
  shift,
  personId,
  pin,
  minHours,
  checkoutWindowMinutes,
  timeFormat,
  onRefresh,
}: {
  shift: ShiftBrief;
  personId: number;
  pin: string;
  minHours: number;
  checkoutWindowMinutes: number;
  timeFormat: TimeFormat;
  onRefresh: () => Promise<void>;
}) {
  const now = useNow();
  const tf = timeFormat === "12h" ? "h:mm A" : "HH:mm";
  const att = shift.attendance;
  const adhoc = shift.is_adhoc;
  const plannedH = dayjs(shift.ends_at).diff(dayjs(shift.starts_at), "minute") / 60;
  const planned = Math.max(Math.round(plannedH * 4) / 4, minHours);
  const elapsedH = att
    ? Math.max(minHours, Math.round((dayjs(now).diff(dayjs(att.checked_in_at), "minute") / 60) * 4) / 4)
    : planned;
  const [hours, setHours] = useState<number>(planned);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [earlyLeave, setEarlyLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const varied = !adhoc && Math.abs(hours - planned) > 0.001;
  // CI-4: two-stage check-out. The check-out button only surfaces within N min of
  // the scheduled end — before that, checking out is "leaving early" (needs a reason).
  // Ad-hoc tasks have no meaningful scheduled end, so they can check out anytime.
  const windowOpensAt = dayjs(shift.ends_at).subtract(checkoutWindowMinutes, "minute");
  const withinWindow = adhoc || !dayjs(now).isBefore(windowOpensAt);
  // Beyond the activity's margin, a reason is required (goes to a manager); leaving
  // early always needs a reason.
  const needsReason =
    earlyLeave ||
    (!adhoc && shift.variance_margin != null && Math.abs(hours - planned) > shift.variance_margin);

  function startCheckout(early: boolean) {
    setHours(early || adhoc ? elapsedH : planned);
    setNotes("");
    setEarlyLeave(early);
    setCheckingOut(true);
  }

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
            {dayjs(shift.starts_at).format(tf)}
            {adhoc ? "" : `–${dayjs(shift.ends_at).format(tf)}`}
            {shift.activity_name ? ` · ${shift.activity_name}` : ""}
            {adhoc ? " · extra task" : ` · planned ${plannedH}h`}
          </Text>
        </div>
        <Group gap="xs">
          {shift.is_new && <Badge size="lg" color="grape" variant="light">New shift</Badge>}
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

      {/* Checked in — offer check-out (two-stage: gated by the check-out window) */}
      {att?.status === "checked_in" && (
        <Stack mt="md">
          <Text>Checked in at <b>{dayjs(att.checked_in_at).format(tf)}</b>.</Text>
          {!checkingOut && withinWindow && (
            <Button size="xl" color="orange" onClick={() => startCheckout(false)}>
              Check out
            </Button>
          )}
          {!checkingOut && !withinWindow && (
            <>
              <Text c="dimmed">
                Enjoy your shift — it's scheduled until{" "}
                <b>{dayjs(shift.ends_at).format(tf)}</b>. Check-out opens at{" "}
                <b>{windowOpensAt.format(tf)}</b>.
              </Text>
              <Button size="md" variant="subtle" color="orange" onClick={() => startCheckout(true)}>
                Need to leave early?
              </Button>
            </>
          )}
          {checkingOut && (
            <>
              {earlyLeave && (
                <Text c="orange" fw={500}>
                  Leaving before your scheduled end ({dayjs(shift.ends_at).format(tf)}).
                </Text>
              )}
              <NumberInput label={adhoc ? "Hours worked" : `Hours worked (planned ${planned}h)`}
                description="Pay is based on the hours you log here, not your check-in/out times."
                min={minHours} step={0.25} value={hours}
                onChange={(v) => setHours(Number(v) || 0)} size="lg" />
              <Textarea
                label={earlyLeave
                  ? "Reason for leaving early (required)"
                  : needsReason
                  ? `Reason required (${hours < planned ? "less" : "more"} than planned — a manager will review)`
                  : varied ? `Note (why ${hours < planned ? "less" : "more"} than planned?)` : "Notes (optional)"}
                value={notes} minRows={2} autosize size="lg"
                onChange={(e) => setNotes(e.currentTarget.value)}
              />
              <Group justify="space-between">
                <Button size="lg" variant="default" onClick={() => setCheckingOut(false)}>Back</Button>
                <Button size="xl" color="orange" loading={busy}
                  disabled={needsReason && !notes.trim()}
                  onClick={() => run(() => terminalApi.checkOut(personId, pin, shift.shift_id, hours, notes || null))}>
                  Confirm check out
                </Button>
              </Group>
            </>
          )}
        </Stack>
      )}

      {/* Done */}
      {att?.status === "checked_out" && (
        <Text mt="md" size="lg">
          Checked out at <b>{dayjs(att.checked_out_at!).format(tf)}</b>
          {att.claimed_hours != null ? ` · ${att.claimed_hours}h recorded` : ""}.
        </Text>
      )}
    </Card>
  );
}
