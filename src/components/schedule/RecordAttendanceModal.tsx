import { Button, Group, Modal, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Shift } from "../../api/types";

/** Manager records/corrects a person's attendance for a shift (backdated), with a reason. */
export function RecordAttendanceModal({ target, onClose }: {
  target: { shift: Shift; personId: number; personName: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [inAt, setInAt] = useState<Date | null>(null);
  const [outAt, setOutAt] = useState<Date | null>(null);
  const [hours, setHours] = useState<number | string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (target) {
      setInAt(dayjs(target.shift.starts_at).toDate());
      setOutAt(dayjs(target.shift.ends_at).toDate());
      setHours(""); setReason("");
    }
  }, [target]);

  const saveM = useMutation({
    mutationFn: () =>
      api.post("/attendance/record", {
        shift_id: target!.shift.id, person_id: target!.personId,
        checked_in_at: dayjs(inAt).format("YYYY-MM-DDTHH:mm:ss"),
        checked_out_at: outAt ? dayjs(outAt).format("YYYY-MM-DDTHH:mm:ss") : null,
        claimed_hours: hours === "" ? null : Number(hours),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      notifications.show({ color: "teal", message: "Attendance recorded." });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened={!!target} onClose={onClose} title="Record attendance">
      {target && (
        <Stack>
          <Text size="sm"><b>{target.personName}</b> · {target.shift.title ?? "shift"}</Text>
          <Text size="xs" c="dimmed">Use this to record or correct a check-in/out (up to 14 days back). Requires a reason.</Text>
          <DateTimePicker label="Checked in" value={inAt} onChange={setInAt} valueFormat="D MMM YYYY HH:mm" />
          <DateTimePicker label="Checked out" value={outAt} onChange={setOutAt} valueFormat="D MMM YYYY HH:mm" clearable />
          <NumberInput label="Paid hours (blank = the shift's planned hours)" min={0} step={0.25} value={hours}
            onChange={setHours} />
          <Textarea label="Reason" required autosize minRows={2} value={reason}
            onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button loading={saveM.isPending} disabled={!inAt || !reason.trim()} onClick={() => saveM.mutate()}>
              Record
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
