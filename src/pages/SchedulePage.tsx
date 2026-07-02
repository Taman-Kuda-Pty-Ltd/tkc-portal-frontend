import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { Activity, Person, Shift } from "../api/types";
import { useAuth } from "../auth/AuthContext";

function mondayOf(d: dayjs.Dayjs): dayjs.Dayjs {
  const dow = (d.day() + 6) % 7; // 0 = Monday
  return d.subtract(dow, "day").startOf("day");
}

export function SchedulePage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => mondayOf(dayjs()));
  const weekEnd = weekStart.add(7, "day");

  const shiftsQ = useQuery({
    queryKey: ["shifts", weekStart.format("YYYY-MM-DD")],
    queryFn: () =>
      api.get<Shift[]>(
        `/shifts?start=${weekStart.format("YYYY-MM-DDTHH:mm:ss")}&end=${weekEnd.format(
          "YYYY-MM-DDTHH:mm:ss",
        )}`,
      ),
  });
  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const peopleQ = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<Person[]>("/people"),
    enabled: can("assign_staff") && can("manage_people"),
  });

  const activityById = useMemo(
    () => new Map((activitiesQ.data ?? []).map((a) => [a.id, a])),
    [activitiesQ.data],
  );
  const personById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p])),
    [peopleQ.data],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (let i = 0; i < 7; i++) map.set(weekStart.add(i, "day").format("YYYY-MM-DD"), []);
    for (const s of shiftsQ.data ?? []) {
      const key = dayjs(s.starts_at).format("YYYY-MM-DD");
      map.get(key)?.push(s);
    }
    return map;
  }, [shiftsQ.data, weekStart]);

  const assignM = useMutation({
    mutationFn: (v: { shiftId: number; personId: number }) =>
      api.post(`/shifts/${v.shiftId}/assignments`, { person_id: v.personId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const unassignM = useMutation({
    mutationFn: (v: { shiftId: number; assignmentId: number }) =>
      api.del(`/shifts/${v.shiftId}/assignments/${v.assignmentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const canAssign = can("assign_staff") && can("manage_people");
  const peopleOptions = (peopleQ.data ?? []).map((p) => ({
    value: String(p.id),
    label: p.full_name,
  }));

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Schedule</Title>
        <Group>
          <ActionIcon
            variant="default"
            onClick={() => setWeekStart(weekStart.subtract(7, "day"))}
            aria-label="Previous week"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Button variant="default" onClick={() => setWeekStart(mondayOf(dayjs()))}>
            {weekStart.format("D MMM")} – {weekStart.add(6, "day").format("D MMM YYYY")}
          </Button>
          <ActionIcon
            variant="default"
            onClick={() => setWeekStart(weekStart.add(7, "day"))}
            aria-label="Next week"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {shiftsQ.isLoading ? (
        <Loader />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4, xl: 7 }} spacing="sm">
          {[...byDay.entries()].map(([day, shifts]) => (
            <Card key={day} withBorder padding="xs">
              <Text fw={600} size="sm" mb="xs">
                {dayjs(day).format("ddd D MMM")}
              </Text>
              <Stack gap="xs">
                {shifts.length === 0 && (
                  <Text size="xs" c="dimmed">
                    —
                  </Text>
                )}
                {shifts.map((s) => {
                  const activity = activityById.get(s.activity_id);
                  return (
                    <Card key={s.id} withBorder radius="sm" padding="xs" bg="var(--mantine-color-body)">
                      <Group gap={6} mb={4} wrap="nowrap">
                        <Badge
                          size="sm"
                          variant="filled"
                          color={activity?.color ? undefined : "teal"}
                          styles={activity?.color ? { root: { background: activity.color } } : undefined}
                        >
                          {activity?.name ?? "Activity"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {dayjs(s.starts_at).format("HH:mm")}–{dayjs(s.ends_at).format("HH:mm")}
                        {s.headcount > 1 ? ` · needs ${s.headcount}` : ""}
                      </Text>
                      <Stack gap={2} mt={6}>
                        {s.assignments.map((a) => (
                          <Group key={a.id} justify="space-between" gap={4} wrap="nowrap">
                            <Text size="xs">
                              {personById.get(a.person_id)?.full_name ?? `#${a.person_id}`}
                            </Text>
                            {canAssign && (
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() =>
                                  unassignM.mutate({ shiftId: s.id, assignmentId: a.id })
                                }
                                aria-label="Remove"
                              >
                                <IconX size={12} />
                              </ActionIcon>
                            )}
                          </Group>
                        ))}
                        {canAssign && (
                          <Select
                            size="xs"
                            placeholder="Assign…"
                            searchable
                            data={peopleOptions}
                            value={null}
                            onChange={(val) =>
                              val && assignM.mutate({ shiftId: s.id, personId: Number(val) })
                            }
                            comboboxProps={{ withinPortal: true }}
                          />
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
