import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import type { Shift } from "../../api/types";
import { formatISOTime } from "../../lib/time";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

/** Compact month-view line: activity dot + abbreviation + assigned staff. */
export function ShiftChip({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  const staff = shift.assignments
    .map((a) => (a.heading_label ? `${a.heading_label}: ${a.person_name ?? "…"}` : a.person_name ?? "…"))
    .join(", ");
  const understaffed = shift.assignments.length < shift.headcount;
  // CAL-SHIFT-TIMES: optionally show the shift's start–end time on the chip.
  const timeLabel = ctx.showTimes
    ? `${formatISOTime(shift.starts_at, ctx.timeFormat)}–${formatISOTime(shift.ends_at, ctx.timeFormat)}`
    : null;
  return (
    <UnstyledButton
      onClick={() => ctx.onOpenShift(shift)}
      style={{ display: "block", width: "100%" }}
      title={`${v.label} · ${staff || "unassigned"}`}
    >
      <Group gap={4} wrap="nowrap" style={{ overflow: "hidden" }}>
        <Box w={7} h={7} style={{ borderRadius: 2, background: v.color, flexShrink: 0 }} />
        <Text fz={10} fw={700} style={{ flexShrink: 0 }}>
          {v.abbr}
        </Text>
        {timeLabel && (
          <Text fz={10} c="dimmed" style={{ flexShrink: 0 }}>
            {timeLabel}
          </Text>
        )}
        <Text fz={10} c={understaffed ? "red" : "dimmed"} truncate style={{ flex: 1 }}>
          {staff || "unassigned"}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
