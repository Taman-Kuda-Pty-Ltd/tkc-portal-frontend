import { Badge, Box, Card, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { IconHorse, IconMapPin, IconUser } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { terminalApi, type ScheduleLesson } from "./terminalApi";

export function ScheduleDisplay({ name }: { name: string }) {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 30_000);
    return () => clearInterval(id);
  }, []);

  const q = useQuery({
    queryKey: ["terminal-schedule"],
    queryFn: () => terminalApi.scheduleDisplay(),
    refetchInterval: 60_000,
  });

  const lessons = q.data?.lessons ?? [];

  return (
    <Box style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Group justify="space-between" px="xl" py="lg"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <div>
          <Text fz={32} fw={800}>{q.data?.heading ?? name}</Text>
          <Text fz={20} c="dimmed">Today's lessons</Text>
        </div>
        <Text fz={40} fw={700} c="teal">{now.format("HH:mm")}</Text>
      </Group>

      <Box style={{ flex: 1, overflow: "auto", padding: "var(--mantine-spacing-xl)" }}>
        {q.isLoading ? (
          <Center h="60vh"><Loader size="xl" /></Center>
        ) : lessons.length === 0 ? (
          <Center h="60vh"><Text fz={28} c="dimmed">No lessons scheduled today.</Text></Center>
        ) : (
          <Stack gap="lg">
            {lessons.map((l) => (
              <LessonCard key={l.shift_id} lesson={l} now={now} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function LessonCard({ lesson, now }: { lesson: ScheduleLesson; now: dayjs.Dayjs }) {
  const past = dayjs(lesson.ends_at).isBefore(now);
  const live = !past && dayjs(lesson.starts_at).isBefore(now);
  const color = lesson.activity_color ?? "#2f855a";
  return (
    <Card withBorder radius="md" p="lg"
      style={{ borderLeft: `10px solid ${color}`, opacity: past ? 0.5 : 1 }}>
      <Group align="flex-start" wrap="nowrap" gap="xl">
        <div style={{ minWidth: 150 }}>
          <Text fz={38} fw={800} lh={1}>{dayjs(lesson.starts_at).format("HH:mm")}</Text>
          <Text fz={20} c="dimmed">{dayjs(lesson.ends_at).format("HH:mm")}</Text>
          {live && <Badge color="teal" size="lg" mt="xs">Now</Badge>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap="md" wrap="wrap" mb="xs">
            <Text fz={26} fw={700}>{lesson.title || lesson.activity_name || "Lesson"}</Text>
            {lesson.facility_name && (
              <Group gap={6}><IconMapPin size={22} /><Text fz={22}>{lesson.facility_name}</Text></Group>
            )}
            {lesson.coaches.length > 0 && (
              <Group gap={6}><IconUser size={22} /><Text fz={22}>{lesson.coaches.join(", ")}</Text></Group>
            )}
          </Group>
          {lesson.riders.length > 0 && (
            <Group gap="md" wrap="wrap">
              {lesson.riders.map((r, i) => (
                <Group key={i} gap={6} px="md" py={6}
                  style={{ background: "var(--mantine-color-default-hover)", borderRadius: 8 }}>
                  <Text fz={22} fw={600}>{r.student}</Text>
                  {r.horse && (
                    <>
                      <IconHorse size={20} />
                      <Text fz={22}>{r.horse}</Text>
                    </>
                  )}
                </Group>
              ))}
            </Group>
          )}
        </div>
      </Group>
    </Card>
  );
}
