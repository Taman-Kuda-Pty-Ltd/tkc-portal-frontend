import {
  ActionIcon,
  Button,
  Group,
  Loader,
  MultiSelect,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconChevronUp, IconPlus } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { Activity, Person, Shift } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ShiftModal } from "../components/ShiftModal";
import { DayView } from "../components/schedule/DayView";
import { MonthView } from "../components/schedule/MonthView";
import { WeekView } from "../components/schedule/WeekView";
import type { ScheduleCtx } from "../components/schedule/types";
import { DAY_KEY, groupByDay, mondayOf } from "../lib/dates";
import { useSettings } from "../settings/SettingsContext";

type View = "month" | "week" | "day";

export function SchedulePage() {
  const { can } = useAuth();
  const { timeFormat } = useSettings();
  const qc = useQueryClient();

  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Dayjs>(() => dayjs());
  const [activityFilter, setActivityFilter] = useState<string[]>([]);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [addingOn, setAddingOn] = useState<Date | null>(null);

  const canManageShifts = can("manage_shifts");
  const canAssign = can("assign_staff") && can("manage_people");

  // Visible date range for the current view.
  const [rangeStart, rangeEnd] = useMemo<[Dayjs, Dayjs]>(() => {
    if (view === "month") {
      const s = mondayOf(anchor.startOf("month"));
      return [s, s.add(42, "day")];
    }
    if (view === "week") {
      const s = mondayOf(anchor);
      return [s, s.add(7, "day")];
    }
    const s = anchor.startOf("day");
    return [s, s.add(1, "day")];
  }, [view, anchor]);

  const shiftsQ = useQuery({
    queryKey: ["shifts", rangeStart.format(DAY_KEY), rangeEnd.format(DAY_KEY)],
    queryFn: () =>
      api.get<Shift[]>(
        `/shifts?start=${rangeStart.format("YYYY-MM-DDTHH:mm:ss")}&end=${rangeEnd.format(
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
    enabled: canAssign,
  });

  const activityById = useMemo(
    () => new Map((activitiesQ.data ?? []).map((a) => [a.id, a])),
    [activitiesQ.data],
  );
  const personById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p])),
    [peopleQ.data],
  );

  const shiftsByDay = useMemo(() => {
    const set = new Set(activityFilter.map(Number));
    const filtered = (shiftsQ.data ?? []).filter(
      (s) => set.size === 0 || set.has(s.activity_id),
    );
    return groupByDay(filtered);
  }, [shiftsQ.data, activityFilter]);

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

  const ctx: ScheduleCtx = {
    activityById,
    personById,
    peopleOptions: (peopleQ.data ?? []).map((p) => ({ value: String(p.id), label: p.full_name })),
    canManageShifts,
    canAssign,
    timeFormat,
    onEditShift: setEditingShift,
    onAddShift: (d) => setAddingOn(d.toDate()),
    onAssign: (shiftId, personId) => assignM.mutate({ shiftId, personId }),
    onUnassign: (shiftId, assignmentId) => unassignM.mutate({ shiftId, assignmentId }),
  };

  // --- navigation ---
  function navigate(dir: 1 | -1) {
    if (view === "month") setAnchor(anchor.add(dir, "month"));
    else if (view === "week") setAnchor(anchor.add(dir * 7, "day"));
    else setAnchor(anchor.add(dir, "day"));
  }
  function selectDay(d: Dayjs) {
    setAnchor(d);
    setView("day");
  }
  function selectWeek(ws: Dayjs) {
    setAnchor(ws);
    setView("week");
  }
  function zoomOut() {
    if (view === "day") setView("week");
    else if (view === "week") setView("month");
  }

  const title =
    view === "month"
      ? anchor.format("MMMM YYYY")
      : view === "week"
        ? `${mondayOf(anchor).format("D MMM")} – ${mondayOf(anchor).add(6, "day").format("D MMM YYYY")}`
        : anchor.format("ddd D MMM YYYY");

  const activityOptions = (activitiesQ.data ?? []).map((a) => ({
    value: String(a.id),
    label: a.name,
  }));
  const addDefault =
    view === "day" ? anchor : view === "week" ? mondayOf(anchor) : anchor.startOf("month");

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs">
          <Button
            variant="subtle"
            px={6}
            onClick={zoomOut}
            disabled={view === "month"}
            leftSection={view !== "month" ? <IconChevronUp size={16} /> : undefined}
          >
            <Text fw={700} size="lg">
              {title}
            </Text>
          </Button>
          {canManageShifts && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setAddingOn(addDefault.toDate())}
            >
              Add shift
            </Button>
          )}
        </Group>

        <Group gap="xs" wrap="wrap">
          <MultiSelect
            size="xs"
            w={200}
            placeholder={activityFilter.length ? undefined : "All activities"}
            data={activityOptions}
            value={activityFilter}
            onChange={setActivityFilter}
            clearable
            searchable
            comboboxProps={{ withinPortal: true }}
          />
          <SegmentedControl
            size="xs"
            value={view}
            onChange={(v) => setView(v as View)}
            data={[
              { label: "Month", value: "month" },
              { label: "Week", value: "week" },
              { label: "Day", value: "day" },
            ]}
          />
          <Group gap={4} wrap="nowrap">
            <ActionIcon variant="default" onClick={() => navigate(-1)} aria-label="Previous">
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Button variant="default" size="xs" onClick={() => setAnchor(dayjs())}>
              Today
            </Button>
            <ActionIcon variant="default" onClick={() => navigate(1)} aria-label="Next">
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </Group>

      {shiftsQ.isLoading ? (
        <Loader />
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          shiftsByDay={shiftsByDay}
          ctx={ctx}
          onSelectDay={selectDay}
          onSelectWeek={selectWeek}
        />
      ) : view === "week" ? (
        <WeekView
          weekStart={mondayOf(anchor)}
          shiftsByDay={shiftsByDay}
          ctx={ctx}
          onSelectDay={selectDay}
        />
      ) : (
        <DayView day={anchor} shifts={shiftsByDay.get(anchor.format(DAY_KEY)) ?? []} ctx={ctx} />
      )}

      <ShiftModal
        shift={editingShift}
        defaultDate={addingOn ?? anchor.toDate()}
        opened={editingShift !== null || addingOn !== null}
        onClose={() => {
          setEditingShift(null);
          setAddingOn(null);
        }}
      />
    </Stack>
  );
}
