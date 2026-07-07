import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { AccountHolderRec, StudentRec } from "../api/types";
import { StudentCard } from "./StudentsSection";
import { StudentRegisterModal } from "./StudentRegisterModal";

/** Club-membership contexts for a person, surfaced on their People detail page:
 * their rider (student) record and/or the riders on their account. Contexts can be
 * attached to this existing person here (the "onboard once" path). */
export function PersonContextsSection({ personId, personName }: { personId: number; personName: string }) {
  const qc = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => api.get<StudentRec[]>("/students") });
  const holdersQ = useQuery({ queryKey: ["account-holders"], queryFn: () => api.get<AccountHolderRec[]>("/account-holders") });
  const students = studentsQ.data ?? [];
  const holders = holdersQ.data ?? [];

  const delStudent = useMutation({
    mutationFn: (id: number) => api.del(`/students/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const makeHolder = useMutation({
    mutationFn: () => api.post("/account-holders", { person_id: personId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-holders"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      notifications.show({ color: "teal", message: `${personName} is now an account holder.` });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const myStudent = students.find((s) => s.person_id === personId);
  const myHolder = holders.find((a) => a.person_id === personId);
  const linked = myHolder
    ? students.filter((s) => s.account_holders.some((h) => h.account_holder_id === myHolder.id))
    : [];

  return (
    <Card withBorder>
      <Title order={4} mb="sm">Club membership</Title>
      <Stack>
        {myStudent ? (
          <div>
            <Text fw={600} size="sm" mb={4}>Rider</Text>
            <StudentCard student={myStudent} holders={holders} onDelete={() => delStudent.mutate(myStudent.id)} />
          </div>
        ) : (
          <Group>
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>Not registered as a rider.</Text>
            <Button size="xs" variant="light" onClick={() => setRegistering(true)}>Register as student</Button>
          </Group>
        )}

        {myHolder ? (
          <div>
            <Text fw={600} size="sm" mb={4}>Account holder — riders on this account</Text>
            {linked.length === 0 && <Text size="sm" c="dimmed">No riders linked to this account yet.</Text>}
            <Stack gap="sm">
              {linked.map((s) => (
                <StudentCard key={s.id} student={s} holders={holders} onDelete={() => delStudent.mutate(s.id)} />
              ))}
            </Stack>
          </div>
        ) : (
          <Group>
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>Not an account holder.</Text>
            <Button size="xs" variant="light" loading={makeHolder.isPending} onClick={() => makeHolder.mutate()}>
              Register as account holder
            </Button>
          </Group>
        )}
      </Stack>

      <StudentRegisterModal opened={registering} onClose={() => setRegistering(false)}
        fixedPersonId={personId} fixedPersonName={personName} />
    </Card>
  );
}
