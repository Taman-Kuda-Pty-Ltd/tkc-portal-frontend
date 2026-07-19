import { ActionIcon, Autocomplete, Button, Checkbox, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, Textarea } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
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
  const [lessonNote, setLessonNote] = useState("");
  // Per-student / per-horse note rows, matching the coach check-out (MGR-LESSON-NOTES).
  type NoteRow = { kind: "student" | "horse"; ref_id: number | null; subject: string; body: string; flagged: boolean };
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [absent, setAbsent] = useState<Set<number>>(new Set());

  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<Activity[]>("/activities"),
  });
  const isLesson = !!activitiesQ.data?.find((a) => a.id === target?.shift.activity_id)?.is_lesson;
  const rides = target?.shift.rides ?? [];
  const studentOptions = rides.map((r) => ({ value: String(r.student_id), label: r.student_name ?? "Student" }));
  const horseNames = Array.from(new Set(rides.map((r) => r.horse_name).filter((h): h is string => !!h)));

  useEffect(() => {
    if (target) {
      setInAt(dayjs(target.shift.starts_at).toDate());
      setOutAt(dayjs(target.shift.ends_at).toDate());
      setHours(""); setReason(""); setLessonNote(""); setNotes([]); setAbsent(new Set());
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
        // Overall lesson note kept in student_notes (back-compat); per-entity rows go
        // in note_items (UAT#3 MGR-LESSON-NOTES).
        student_notes: isLesson && lessonNote.trim() ? lessonNote.trim() : null,
        note_items: isLesson
          ? notes.filter((n) => n.body.trim()).map((n) => ({
              kind: n.kind, ref_id: n.ref_id, subject: n.subject || null, body: n.body.trim(), flagged: n.flagged,
            }))
          : [],
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
              <Textarea label="Overall lesson note" autosize minRows={2} value={lessonNote}
                onChange={(e) => setLessonNote(e.currentTarget.value)} />
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={600}>Per-student / per-horse notes</Text>
                  <Group gap={4}>
                    <Button size="xs" variant="light" leftSection={<IconPlus size={12} />}
                      onClick={() => setNotes((n) => [...n, { kind: "student", ref_id: null, subject: "", body: "", flagged: false }])}>
                      Student
                    </Button>
                    <Button size="xs" variant="light" color="orange" leftSection={<IconPlus size={12} />}
                      onClick={() => setNotes((n) => [...n, { kind: "horse", ref_id: null, subject: "", body: "", flagged: false }])}>
                      Horse
                    </Button>
                  </Group>
                </Group>
                <Stack gap="xs">
                  {notes.map((n, i) => {
                    const upd = (patch: Partial<NoteRow>) => setNotes((rows) => rows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)));
                    return (
                      <div key={i} style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8, padding: 8 }}>
                        <Group gap="xs" wrap="nowrap" mb={4}>
                          <SegmentedControl size="xs" value={n.kind}
                            onChange={(v) => upd({ kind: v as "student" | "horse", ref_id: null, subject: "" })}
                            data={[{ label: "Student", value: "student" }, { label: "Horse", value: "horse" }]} />
                          {n.kind === "student" ? (
                            <Select size="xs" placeholder="Student" style={{ flex: 1 }} data={studentOptions}
                              value={n.ref_id ? String(n.ref_id) : null} comboboxProps={{ withinPortal: true }}
                              onChange={(v) => { const o = studentOptions.find((x) => x.value === v); upd({ ref_id: v ? Number(v) : null, subject: o?.label ?? "" }); }} />
                          ) : (
                            <Autocomplete size="xs" placeholder="Horse" style={{ flex: 1 }} data={horseNames}
                              value={n.subject} comboboxProps={{ withinPortal: true }}
                              onChange={(v) => upd({ subject: v })} />
                          )}
                          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => setNotes((rows) => rows.filter((_, ri) => ri !== i))}>
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                        <Textarea size="xs" placeholder="Note" autosize minRows={1} value={n.body}
                          onChange={(e) => upd({ body: e.currentTarget.value })} />
                        <Checkbox size="xs" mt={4} label="Flag for a manager to review" checked={n.flagged}
                          onChange={(e) => upd({ flagged: e.currentTarget.checked })} />
                      </div>
                    );
                  })}
                </Stack>
              </div>
            </>
          ) : (
            <NumberInput label="Paid hours" description="Blank = the shift's scheduled hours"
              min={0} step={0.25} value={hours} onChange={setHours} />
          )}
          <Textarea label="Reason not checked in/out normally" required autosize minRows={2}
            description="Why this shift is being recorded manually (e.g. missed check-in, cancelled, covered)."
            value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
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
