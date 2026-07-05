import { ActionIcon, Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { AccountHolderRec } from "../api/types";

export function AccountHoldersSection() {
  const qc = useQueryClient();
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [email, setEmail] = useState("");
  const q = useQuery({ queryKey: ["account-holders"], queryFn: () => api.get<AccountHolderRec[]>("/account-holders") });

  const createM = useMutation({
    mutationFn: () =>
      api.post("/account-holders", {
        given_name: given.trim(),
        family_name: family.trim(),
        email: email.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-holders"] });
      setGiven(""); setFamily(""); setEmail("");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/account-holders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-holders"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        The people who manage a student's lessons and pay — a parent/guardian, or an adult
        student managing themselves. Emails/notifications for a child's lessons go here.
      </Text>
      <Group align="flex-end">
        <TextInput label="First name" value={given} onChange={(e) => setGiven(e.currentTarget.value)} />
        <TextInput label="Last name" value={family} onChange={(e) => setFamily(e.currentTarget.value)} />
        <TextInput label="Email" style={{ flex: 1 }} value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <Button loading={createM.isPending} disabled={!given.trim() && !family.trim()} onClick={() => createM.mutate()}>
          Add
        </Button>
      </Group>
      <Stack gap="xs">
        {(q.data ?? []).map((a) => (
          <Card key={a.id} withBorder padding="sm">
            <Group justify="space-between">
              <div>
                <Text fw={600}>{a.name}</Text>
                {a.email && <Text size="sm" c="dimmed">{a.email}</Text>}
              </div>
              <ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={() => delM.mutate(a.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No account holders yet.</Text>}
      </Stack>
    </Stack>
  );
}
