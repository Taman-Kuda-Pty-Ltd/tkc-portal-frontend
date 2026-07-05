import { Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface OrgSettings {
  min_shift_hours: number;
  default_lesson_hours: number;
  secondary_coach_share: number;
  pay_period_start_weekday: number;
  pay_period_days: number;
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
  const [periodDays, setPeriodDays] = useState<number | string>(7);
  useEffect(() => {
    if (q.data) {
      setHours(q.data.min_shift_hours);
      setLessonHours(q.data.default_lesson_hours);
      setSecShare(q.data.secondary_coach_share);
      setWeekday(String(q.data.pay_period_start_weekday));
      setPeriodDays(q.data.pay_period_days);
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.put("/settings/org", {
        min_shift_hours: Number(hours) || 0,
        default_lesson_hours: Number(lessonHours) || 0,
        secondary_coach_share: Number(secShare) || 0,
        pay_period_start_weekday: Number(weekday) || 0,
        pay_period_days: Number(periodDays) || 7,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      notifications.show({ color: "teal", message: "Saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
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
        The pay period used by payroll reports (weekly, starting Monday by default).
      </Text>
      <Group align="flex-end">
        <Select label="Pay period starts" w={160} data={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          value={weekday} onChange={(v) => v && setWeekday(v)} />
        <NumberInput label="Days in period" min={1} w={140} value={periodDays} onChange={setPeriodDays} />
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
      </Group>
    </Stack>
  );
}
