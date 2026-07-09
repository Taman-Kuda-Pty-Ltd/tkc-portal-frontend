import { Button, Group, NumberInput, SegmentedControl, Select, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
];
// The IANA zones the club is likely to run in (searchable; the backend accepts any valid zone).
const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "UTC",
];

interface OrgSettings {
  min_shift_hours: number;
  default_lesson_hours: number;
  secondary_coach_share: number;
  pay_period_start_weekday: number;
  pay_period_days: number;
  checkout_window_minutes: number;
  checkout_overdue_grace_minutes: number;
  pay_period_frequency: string;
  pay_period_anchor: string | null;
  business_timezone: string;
  terminal_time_format: string;
}

export function OrgSettingsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<OrgSettings>("/settings/org"),
  });
  const [hours, setHours] = useState<number | string>(1);
  const [lessonHours, setLessonHours] = useState<number | string>(1);
  const [secShare, setSecShare] = useState<number | string>(0.5);
  const [weekday, setWeekday] = useState<string>("0");
  const [checkoutWindow, setCheckoutWindow] = useState<number | string>(45);
  const [overdueGrace, setOverdueGrace] = useState<number | string>(60);
  const [frequency, setFrequency] = useState<string>("weekly");
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [tz, setTz] = useState<string>("Australia/Sydney");
  const [timeFmt, setTimeFmt] = useState<string>("24h");
  useEffect(() => {
    if (q.data) {
      setHours(q.data.min_shift_hours);
      setLessonHours(q.data.default_lesson_hours);
      setSecShare(q.data.secondary_coach_share);
      setWeekday(String(q.data.pay_period_start_weekday));
      setCheckoutWindow(q.data.checkout_window_minutes);
      setOverdueGrace(q.data.checkout_overdue_grace_minutes ?? 60);
      setFrequency(q.data.pay_period_frequency ?? "weekly");
      setAnchor(q.data.pay_period_anchor ? dayjs(q.data.pay_period_anchor).toDate() : null);
      setTz(q.data.business_timezone ?? "Australia/Sydney");
      setTimeFmt(q.data.terminal_time_format ?? "24h");
    }
  }, [q.data]);

  const periodDays = frequency === "fortnightly" ? 14 : 7; // monthly derives on the backend

  const saveM = useMutation({
    mutationFn: () =>
      api.put("/settings/org", {
        min_shift_hours: Number(hours) || 0,
        default_lesson_hours: Number(lessonHours) || 0,
        secondary_coach_share: Number(secShare) || 0,
        pay_period_start_weekday: Number(weekday) || 0,
        pay_period_days: periodDays,
        checkout_window_minutes: Number(checkoutWindow) || 0,
        checkout_overdue_grace_minutes: Number(overdueGrace) || 0,
        pay_period_frequency: frequency,
        pay_period_anchor:
          frequency === "fortnightly" && anchor ? dayjs(anchor).format("YYYY-MM-DD") : null,
        business_timezone: tz,
        terminal_time_format: timeFmt,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      notifications.show({ color: "teal", message: "Saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const tzData = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        The club's timezone. It sets when "today" rolls over on the terminals and reports,
        and the offset used so scheduled times show correctly on every device.
      </Text>
      <Select label="Business timezone" w={260} data={tzData} value={tz}
        onChange={(v) => v && setTz(v)} searchable allowDeselect={false}
        comboboxProps={{ withinPortal: true }} />
      <Text size="sm" c="dimmed" mt="xs">
        How the kiosk terminals show the clock and times — 24-hour or 12-hour (AM/PM).
        Affects the terminals only; each user's own app preference is separate.
      </Text>
      <div>
        <Text size="sm" fw={500} mb={4}>Terminal time format</Text>
        <SegmentedControl value={timeFmt} onChange={setTimeFmt}
          data={[{ label: "24-hour", value: "24h" }, { label: "12-hour", value: "12h" }]} />
      </div>
      <Text size="sm" c="dimmed" mt="xs">
        The minimum paid hours recorded for any stablehand/ad-hoc terminal check-out.
        If someone works or logs less than this, their hours are floored to it.
      </Text>
      <NumberInput label="Minimum shift hours" min={0} step={0.25} w={180}
        value={hours} onChange={setHours} />
      <Text size="sm" c="dimmed" mt="xs">
        Lessons are piece-work (1 lesson = 1 hour by default). This is the fallback pay
        per lesson when a lesson type sets no default of its own; each lesson can still
        be overridden.
      </Text>
      <NumberInput label="Default lesson pay (hours)" min={0} step={0.25} w={180}
        value={lessonHours} onChange={setLessonHours} />
      <Text size="sm" c="dimmed" mt="xs">
        A secondary (shadowing) coach on a lesson earns this share of the lesson's pay —
        e.g. 0.5 means a new coach watching a senior coach is paid 50%.
      </Text>
      <NumberInput label="Secondary coach share" min={0} max={1} step={0.05} w={180}
        value={secShare} onChange={setSecShare} />
      <Text size="sm" c="dimmed" mt="xs">
        On the check-in terminal the <b>Check out</b> button only appears this many minutes
        before a shift's scheduled end — so staff can't accidentally check straight back out
        after checking in. Leaving before then is still possible via “Leave early” (with a reason).
      </Text>
      <NumberInput label="Check-out window (minutes before end)" min={0} step={5} w={260}
        value={checkoutWindow} onChange={setCheckoutWindow} />
      <Text size="sm" c="dimmed" mt="xs">
        How long after a shift's scheduled end before someone still checked in appears
        in the “check-out is due” heads-up — so it doesn't fire the moment they check in.
      </Text>
      <NumberInput label="Check-out overdue grace (minutes after end)" min={0} step={5} w={260}
        value={overdueGrace} onChange={setOverdueGrace} />
      <Text size="sm" c="dimmed" mt="xs">
        The pay period used by payroll reports. Monthly uses calendar months; fortnightly
        counts from the anchor date so periods never drift.
      </Text>
      <Group align="flex-end">
        <Select label="Frequency" w={150} data={FREQUENCIES} value={frequency}
          onChange={(v) => v && setFrequency(v)} allowDeselect={false} />
        {frequency !== "monthly" && (
          <Select label="Starts on" w={150} data={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
            value={weekday} onChange={(v) => v && setWeekday(v)} />
        )}
        {frequency === "fortnightly" && (
          <DateInput label="Anchor date" w={160} value={anchor} onChange={setAnchor} valueFormat="D MMM YYYY"
            description="Any day in a known fortnight" />
        )}
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
      </Group>
    </Stack>
  );
}
