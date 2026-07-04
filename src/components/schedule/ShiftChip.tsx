import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import type { Shift } from "../../api/types";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

/** Compact month-view line: activity dot + abbreviation + assigned staff. */
export function ShiftChip({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  const staff = shift.assignments
    .map((a) => (a.role_name ? `${a.role_name}: ${a.person_name ?? "…"}` : a.person_name ?? "…"))
    .join(", ");
  const understaffed = shift.assignments.length < shift.headcount;
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
        <Text fz={10} c={understaffed ? "red" : "dimmed"} truncate style={{ flex: 1 }}>
          {staff || "unassigned"}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
