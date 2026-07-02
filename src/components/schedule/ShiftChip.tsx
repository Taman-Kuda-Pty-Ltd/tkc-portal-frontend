import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { formatISOTime } from "../../lib/time";
import type { Shift } from "../../api/types";
import { shiftVisual } from "./types";
import type { ScheduleCtx } from "./types";

/** Compact one-line shift representation used in the Month grid. */
export function ShiftChip({ shift, ctx }: { shift: Shift; ctx: ScheduleCtx }) {
  const v = shiftVisual(shift, ctx);
  return (
    <UnstyledButton
      onClick={() => ctx.canManageShifts && ctx.onEditShift(shift)}
      style={{ display: "block", width: "100%" }}
      title={`${v.label} · ${v.assigned}/${v.needed} assigned`}
    >
      <Group gap={4} wrap="nowrap" style={{ overflow: "hidden" }}>
        <Box
          w={7}
          h={7}
          style={{ borderRadius: 2, background: v.color, flexShrink: 0 }}
        />
        <Text fz={10} c={v.assigned === 0 ? "red" : undefined} truncate style={{ flex: 1 }}>
          {formatISOTime(shift.starts_at, ctx.timeFormat)} {v.label}
        </Text>
        {v.assigned < v.needed && (
          <Text fz={10} c="dimmed" style={{ flexShrink: 0 }}>
            {v.assigned}/{v.needed}
          </Text>
        )}
      </Group>
    </UnstyledButton>
  );
}
