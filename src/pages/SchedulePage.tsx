import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconChevronUp, IconPlus } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Activity, Person, ScheduleLens, Shift, ShiftClash } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ShiftModal } from "../components/ShiftModal";
import { RecordAttendanceModal } from "../components/schedule/RecordAttendanceModal";
import { DayView } from "../components/schedule/DayView";
import { MonthView } from "../components/schedule/MonthView";
import { TimeGrid } from "../components/schedule/TimeGrid";
import { WeekView } from "../components/schedule/WeekView";
import type { ScheduleCtx } from "../components/schedule/types";
import { DAY_KEY, groupByDay, mondayOf } from "../lib/dates";
import { useSettings } from "../settings/SettingsContext";

type Span = "month" | "week" | "day";
// How the schedule is drawn (List = rows, Grid = hour-grid, Calendar = month boxes)
// and, for List/Grid, over what range. Calendar always spans a month (SC-8).
type Mode = "list" | "grid" | "calendar";
type DayWeek = "day" | "week";

export function SchedulePage() {
  const { can } = useAuth();
  const { timeFormat } = useSettings();
  const qc = useQueryClient();

  const LENS_KEY = "tkc_activity_lens";
  const MODE_KEY = "tkc_schedule_mode";
  const RANGE_KEY = "tkc_schedule_range";
  const [anchor, setAnchor] = useState<Dayjs>(() => dayjs());
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(MODE_KEY) as Mode) || "list",
  );
  const [range, setRange] = useState<DayWeek>(
    () => (localStorage.getItem(RANGE_KEY) as DayWeek) || "week",
  );
  // The effective time span: Calendar is always a month; List/Grid follow the range.
  const span: Span = mode === "calendar" ? "month" : range;
  // Which activity "lens" is active: "all" or a specific lens id (as string).
  const [lens, setLens] = useState<string>(() => localStorage.getItem(LENS_KEY) || "all");
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [addingOn, setAddingOn] = useState<Date | null>(null);
  const [recordTarget, setRecordTarget] = useState<{ shift: Shift; personId: number; personName: string } | null>(null);
  const [highlightShiftId, setHighlightShiftId] = useState<number | null>(null);

  const canManageShifts = can("manage_shifts");
  const canAssignCap = can("assign_staff") && can("manage_people");
  // View/Edit toggle (UAT#3 SCHED-TOGGLE): managers see the staff-facing view by
  // default and switch to Edit to reveal assign controls. Non-managers only ever view.
  const [editMode, setEditMode] = useState(false);
  const canAssign = canAssignCap && editMode;
  // COACH-ASSIGN-EDITMODE: editing a shift (times/activity/riders/coach) is only
  // allowed in Edit mode — View mode is read-only. Creating a new shift (addingOn)
  // always allows editing (Add is itself an Edit-mode action).
  const canEditShift = canManageShifts && (editMode || addingOn !== null);

  // Visible date range for the current view.
  const [rangeStart, rangeEnd] = useMemo<[Dayjs, Dayjs]>(() => {
    if (span === "month") {
      const s = mondayOf(anchor.startOf("month"));
      return [s, s.add(42, "day")];
    }
    if (span === "week") {
      const s = mondayOf(anchor);
      return [s, s.add(7, "day")];
    }
    const s = anchor.startOf("day");
    return [s, s.add(1, "day")];
  }, [span, anchor]);

  const shiftsQ = useQuery({
    queryKey: ["shifts", rangeStart.format(DAY_KEY), rangeEnd.format(DAY_KEY)],
    queryFn: () =>
      api.get<Shift[]>(
        `/shifts?start=${rangeStart.format("YYYY-MM-DDTHH:mm:ss")}&end=${rangeEnd.format(
          "YYYY-MM-DDTHH:mm:ss",
        )}`,
      ),
  });
  // Keep the open shift modal in sync with fresh data after any ["shifts"]
  // invalidation, so notes/assignments/rides added in the modal appear live
  // (the modal renders from this object, not its own refetch).
  useEffect(() => {
    if (!editingShift || !shiftsQ.data) return;
    const fresh = shiftsQ.data.find((s) => s.id === editingShift.id);
    if (fresh && fresh !== editingShift) setEditingShift(fresh);
  }, [shiftsQ.data, editingShift]);

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  // DBL-1: double-booked horses/coaches across the visible range.
  const clashesQ = useQuery({
    queryKey: ["clashes", rangeStart.format(DAY_KEY), rangeEnd.format(DAY_KEY)],
    queryFn: () =>
      api.get<ShiftClash[]>(
        `/shifts/clashes?start=${rangeStart.format("YYYY-MM-DDTHH:mm:ss")}&end=${rangeEnd.format(
          "YYYY-MM-DDTHH:mm:ss",
        )}`,
      ),
    enabled: canManageShifts,
  });
  const peopleQ = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<Person[]>("/people"),
    enabled: canAssign,
  });
  const lensesQ = useQuery({
    queryKey: ["schedule-lenses"],
    queryFn: () => api.get<ScheduleLens[]>("/schedule-lenses"),
  });

  const activityById = useMemo(
    () => new Map((activitiesQ.data ?? []).map((a) => [a.id, a])),
    [activitiesQ.data],
  );
  const personById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p])),
    [peopleQ.data],
  );

  const lensById = useMemo(
    () => new Map((lensesQ.data ?? []).map((l) => [String(l.id), l])),
    [lensesQ.data],
  );
  const clashByShift = useMemo(() => {
    const m = new Map<number, ShiftClash[]>();
    for (const c of clashesQ.data ?? []) {
      const list = m.get(c.shift_id) ?? [];
      list.push(c);
      m.set(c.shift_id, list);
    }
    return m;
  }, [clashesQ.data]);

  const shiftsByDay = useMemo(() => {
    const selected = lensById.get(lens);
    const filtered =
      lens === "all" || !selected
        ? (shiftsQ.data ?? [])
        : (shiftsQ.data ?? []).filter((s) => selected.activity_ids.includes(s.activity_id));
    return groupByDay(filtered);
  }, [shiftsQ.data, lens, lensById]);

  function chooseLens(v: string | null) {
    const next = v ?? "all";
    setLens(next);
    localStorage.setItem(LENS_KEY, next);
  }
  function chooseMode(v: string) {
    setMode(v as Mode);
    localStorage.setItem(MODE_KEY, v);
  }
  function chooseRange(v: string) {
    setRange(v as DayWeek);
    localStorage.setItem(RANGE_KEY, v);
  }

  const assignM = useMutation({
    mutationFn: (v: { shiftId: number; personId: number; headingId: number | null }) =>
      api.post(`/shifts/${v.shiftId}/assignments`, { person_id: v.personId, heading_id: v.headingId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const unassignM = useMutation({
    mutationFn: (v: { shiftId: number; assignmentId: number }) =>
      api.del(`/shifts/${v.shiftId}/assignments/${v.assignmentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const coachKindM = useMutation({
    mutationFn: (v: { shiftId: number; assignmentId: number; kind: "primary" | "secondary" }) =>
      api.patch(`/shifts/${v.shiftId}/assignments/${v.assignmentId}`, { coach_kind: v.kind }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const draftCount = (shiftsQ.data ?? []).filter((s) => s.status === "draft").length;
  const publishDraftsM = useMutation({
    mutationFn: () =>
      api.post<number>(
        `/shifts/publish?start=${rangeStart.format("YYYY-MM-DDTHH:mm:ss")}&end=${rangeEnd.format("YYYY-MM-DDTHH:mm:ss")}`,
      ),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      notifications.show({ color: "teal", message: `Published ${n} shift${n === 1 ? "" : "s"}.` });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // SC-7 / SC-11: jump the schedule to a shift and briefly highlight it.
  function goToShift(s: Shift) {
    setAnchor(dayjs(s.starts_at));
    if (mode === "calendar") chooseMode("list"); // a card view so the highlight shows
    chooseRange("day");
    setHighlightShiftId(s.id);
  }
  useEffect(() => {
    if (highlightShiftId === null) return;
    const t = window.setTimeout(() => setHighlightShiftId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightShiftId]);
  function handleCreated(s: Shift) {
    notifications.show({
      color: "teal",
      autoClose: 8000,
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <span>Shift created for {dayjs(s.starts_at).format("ddd D MMM")}.</span>
          <Button size="compact-xs" variant="white" onClick={() => goToShift(s)}>Go to it</Button>
        </Group>
      ),
    });
  }

  const ctx: ScheduleCtx = {
    activityById,
    personById,
    peopleOptions: (peopleQ.data ?? []).map((p) => ({ value: String(p.id), label: p.full_name })),
    canManageShifts,
    canAssign,
    timeFormat,
    clashByShift,
    highlightShiftId,
    onOpenShift: setEditingShift,
    onAddShift: (d) => setAddingOn(d.toDate()),
    onAssign: (shiftId, personId, headingId) => assignM.mutate({ shiftId, personId, headingId }),
    onUnassign: (shiftId, assignmentId) => unassignM.mutate({ shiftId, assignmentId }),
    onSetCoachKind: (shiftId, assignmentId, kind) => coachKindM.mutate({ shiftId, assignmentId, kind }),
    onRecordAttendance: (shift, personId, personName) => setRecordTarget({ shift, personId, personName }),
  };

  // --- navigation ---
  function navigate(dir: 1 | -1) {
    if (span === "month") setAnchor(anchor.add(dir, "month"));
    else if (span === "week") setAnchor(anchor.add(dir * 7, "day"));
    else setAnchor(anchor.add(dir, "day"));
  }
  // Drilling into a day/week from the Calendar hands off to a List view of it.
  function selectDay(d: Dayjs) {
    setAnchor(d);
    if (mode === "calendar") chooseMode("list");
    chooseRange("day");
  }
  function selectWeek(ws: Dayjs) {
    setAnchor(ws);
    if (mode === "calendar") chooseMode("list");
    chooseRange("week");
  }
  // Zoom out: day → week (same mode) → month calendar.
  function zoomOut() {
    if (span === "day") chooseRange("week");
    else if (span === "week") chooseMode("calendar");
  }

  const title =
    span === "month"
      ? anchor.format("MMMM YYYY")
      : span === "week"
        ? `${mondayOf(anchor).format("D MMM")} – ${mondayOf(anchor).add(6, "day").format("D MMM YYYY")}`
        : anchor.format("ddd D MMM YYYY");

  const addDefault =
    span === "day" ? anchor : span === "week" ? mondayOf(anchor) : anchor.startOf("month");

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs">
          <Button
            variant="subtle"
            px={6}
            onClick={zoomOut}
            disabled={span === "month"}
            leftSection={span !== "month" ? <IconChevronUp size={16} /> : undefined}
          >
            <Text fw={700} size="lg">
              {title}
            </Text>
          </Button>
          {canManageShifts && editMode && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setAddingOn(addDefault.toDate())}
            >
              Add shift
            </Button>
          )}
          {canManageShifts && editMode && draftCount > 0 && (
            <Button size="xs" color="teal" loading={publishDraftsM.isPending}
              onClick={() => publishDraftsM.mutate()}>
              Publish {draftCount} draft{draftCount === 1 ? "" : "s"}
            </Button>
          )}
        </Group>

        <Group gap="xs" wrap="wrap">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={chooseMode}
            data={[
              { label: "List", value: "list" },
              { label: "Grid", value: "grid" },
              { label: "Calendar", value: "calendar" },
            ]}
          />
          {mode !== "calendar" && (
            <SegmentedControl
              size="xs"
              value={range}
              onChange={chooseRange}
              data={[
                { label: "Day", value: "day" },
                { label: "Week", value: "week" },
              ]}
            />
          )}
          {(canAssignCap || canManageShifts) && (
            <Group gap={6} wrap="nowrap">
              <SegmentedControl
                size="xs"
                // SCHED-TOGGLE-VISIBILITY: colour the active state (brand maroon in Edit)
                // so the mode is obvious at a glance rather than a grey control.
                color={editMode ? "tkc" : "gray"}
                value={editMode ? "edit" : "view"}
                onChange={(v) => setEditMode(v === "edit")}
                data={[
                  { label: "View", value: "view" },
                  { label: "Edit", value: "edit" },
                ]}
              />
              {/* SCHED-UNPUBLISHED-INDICATOR: flag unpublished draft changes while in View. */}
              {!editMode && draftCount > 0 && (
                <Badge color="orange" variant="light" size="sm">
                  {draftCount} unpublished
                </Badge>
              )}
            </Group>
          )}
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

      <Tabs value={lens} onChange={chooseLens} variant="default">
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          {(lensesQ.data ?? []).map((l) => (
            <Tabs.Tab
              key={l.id}
              value={String(l.id)}
              leftSection={
                l.activity_ids.length ? (
                  <Group gap={2} wrap="nowrap">
                    {l.activity_ids.slice(0, 4).map((aid) => (
                      <Box
                        key={aid}
                        w={7}
                        h={7}
                        style={{
                          borderRadius: "50%",
                          background: activityById.get(aid)?.color ?? "#718096",
                        }}
                      />
                    ))}
                  </Group>
                ) : undefined
              }
            >
              {l.name}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {shiftsQ.isLoading ? (
        <Loader />
      ) : mode === "calendar" ? (
        <MonthView
          anchor={anchor}
          shiftsByDay={shiftsByDay}
          ctx={ctx}
          onSelectDay={selectDay}
          onSelectWeek={selectWeek}
        />
      ) : range === "week" ? (
        mode === "grid" ? (
          <TimeGrid
            days={Array.from({ length: 7 }, (_, i) => mondayOf(anchor).add(i, "day"))}
            shiftsByDay={shiftsByDay}
            ctx={ctx}
            onSelectDay={selectDay}
          />
        ) : (
          <WeekView
            weekStart={mondayOf(anchor)}
            shiftsByDay={shiftsByDay}
            ctx={ctx}
            onSelectDay={selectDay}
          />
        )
      ) : mode === "grid" ? (
        <TimeGrid days={[anchor]} shiftsByDay={shiftsByDay} ctx={ctx} />
      ) : (
        <DayView day={anchor} shifts={shiftsByDay.get(anchor.format(DAY_KEY)) ?? []} ctx={ctx} />
      )}

      <ShiftModal
        shift={editingShift}
        defaultDate={addingOn ?? anchor.toDate()}
        opened={editingShift !== null || addingOn !== null}
        canEdit={canEditShift}
        canAssign={canAssign}
        canManageShifts={canManageShifts}
        onRecordAttendance={(shift, personId, personName) =>
          setRecordTarget({ shift, personId, personName })
        }
        onCreated={handleCreated}
        onClose={() => {
          setEditingShift(null);
          setAddingOn(null);
        }}
      />
      <RecordAttendanceModal target={recordTarget} onClose={() => setRecordTarget(null)} />
    </Stack>
  );
}
