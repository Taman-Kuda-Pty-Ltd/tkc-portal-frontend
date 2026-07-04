import { Badge, Box, Card, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { IconHorse, IconMapPin, IconUser } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { terminalApi, type ScheduleEntry } from "./terminalApi";

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

  const entries = q.data?.entries ?? [];

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
        ) : entries.length === 0 ? (
          <Center h="60vh"><Text fz={28} c="dimmed">Nothing scheduled today.</Text></Center>
        ) : (
          <Stack gap="lg">
            {entries.map((e) => (
              <EntryCard key={e.shift_id} entry={e} now={now} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function EntryCard({ entry, now }: { entry: ScheduleEntry; now: dayjs.Dayjs }) {
  const past = dayjs(entry.ends_at).isBefore(now);
  const live = !past && dayjs(entry.starts_at).isBefore(now);
  const color = entry.activity_color ?? "#2f855a";
  return (
    <Card withBorder radius="md" p="lg"
      style={{ borderLeft: `10px solid ${color}`, opacity: past ? 0.5 : 1 }}>
      <Group align="flex-start" wrap="nowrap" gap="xl">
        <div style={{ minWidth: 150 }}>
          <Text fz={38} fw={800} lh={1}>{dayjs(entry.starts_at).format("HH:mm")}</Text>
          <Text fz={20} c="dimmed">{dayjs(entry.ends_at).format("HH:mm")}</Text>
          {live && <Badge color="teal" size="lg" mt="xs">Now</Badge>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap="md" wrap="wrap" mb="xs">
            <Text fz={26} fw={700}>{entry.title || entry.activity_name || "Shift"}</Text>
            {entry.facility_name && (
              <Group gap={6}><IconMapPin size={22} /><Text fz={22}>{entry.facility_name}</Text></Group>
            )}
            {entry.people.length > 0 && (
              <Group gap={6}><IconUser size={22} /><Text fz={22}>{entry.people.join(", ")}</Text></Group>
            )}
            {!entry.is_lesson && entry.activity_name && entry.title && (
              <Badge size="lg" variant="light">{entry.activity_name}</Badge>
            )}
          </Group>
          {entry.riders.length > 0 && (
            <Group gap="md" wrap="wrap">
              {entry.riders.map((r, i) => (
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
