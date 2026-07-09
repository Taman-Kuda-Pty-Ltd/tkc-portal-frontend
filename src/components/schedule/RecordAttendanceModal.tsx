import { Button, Checkbox, Group, Modal, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Activity, Shift } from "../../api/types";

/** Manager records/corrects a person's attendance for a shift (backdated), with a reason.
 *  For a lesson it also captures the same data a coach would (MGR-CHK): horse notes,
 *  student notes, and which riders attended. */
export function RecordAttendanceModal({ target, onClose }: {
  target: { shift: Shift; personId: number; personName: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [inAt, setInAt] = useState<Date | null>(null);
  const [outAt, setOutAt] = useState<Date | null>(null);
  const [hours, setHours] = useState<number | string>("");
  const [reason, setReason] = useState("");
  const [horseNotes, setHorseNotes] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [absent, setAbsent] = useState<Set<number>>(new Set());

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const isLesson = !!activitiesQ.data?.find((a) => a.id === target?.shift.activity_id)?.is_lesson;
  const rides = target?.shift.rides ?? [];

  useEffect(() => {
    if (target) {
      setInAt(dayjs(target.shift.starts_at).toDate());
      setOutAt(dayjs(target.shift.ends_at).toDate());
      setHours(""); setReason(""); setHorseNotes(""); setStudentNotes(""); setAbsent(new Set());
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
        horse_notes: isLesson && horseNotes.trim() ? horseNotes.trim() : null,
        student_notes: isLesson && studentNotes.trim() ? studentNotes.trim() : null,
        rider_attendance: isLesson
          ? rides.map((r) => ({ student_id: r.student_id, attended: !absent.has(r.student_id) }))
          : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      notifications.show({ color: "teal", message: "Attendance recorded." });
      onClose();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  function toggleAbsent(studentId: number, isAbsent: boolean) {
    setAbsent((prev) => {
      const next = new Set(prev);
      if (isAbsent) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  return (
    <Modal opened={!!target} onClose={onClose} title="Record attendance">
      {target && (
        <Stack>
          <Text size="sm"><b>{target.personName}</b> · {target.shift.title ?? "shift"}</Text>
          <Text size="xs" c="dimmed">Use this to record or correct a check-in/out (up to 14 days back). Requires a reason.</Text>
          <DateTimePicker label="Checked in" value={inAt} onChange={setInAt} valueFormat="D MMM YYYY HH:mm" />
          <DateTimePicker label="Checked out" value={outAt} onChange={setOutAt} valueFormat="D MMM YYYY HH:mm" clearable />
          {isLesson ? (
            <>
              <Text size="xs" c="dimmed">
                Recording this lesson on the coach's behalf — capture what they would.
              </Text>
              {rides.length > 0 && (
                <Stack gap={4}>
                  <Text size="sm" fw={600}>Riders</Text>
                  {rides.map((r) => (
                    <Checkbox
                      key={r.student_id}
                      label={(r.student_name ?? "Student") + (r.horse_name ? ` on ${r.horse_name}` : "")}
                      checked={!absent.has(r.student_id)}
                      onChange={(e) => toggleAbsent(r.student_id, !e.currentTarget.checked)}
                      description={absent.has(r.student_id) ? "Absent" : "Attended"}
                    />
                  ))}
                </Stack>
              )}
              <Textarea label="Horse notes" autosize minRows={2} value={horseNotes}
                onChange={(e) => setHorseNotes(e.currentTarget.value)} />
              <Textarea label="Student notes" autosize minRows={2} value={studentNotes}
                onChange={(e) => setStudentNotes(e.currentTarget.value)} />
            </>
          ) : (
            <NumberInput label="Paid hours (blank = the shift's planned hours)" min={0} step={0.25} value={hours}
              onChange={setHours} />
          )}
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
