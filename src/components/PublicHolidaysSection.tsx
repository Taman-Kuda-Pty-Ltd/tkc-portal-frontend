import { ActionIcon, Button, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";

interface PublicHoliday { id: number; date: string; name: string }

export function PublicHolidaysSection() {
  const qc = useQueryClient();
  const [date, setDate] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: ["public-holidays"], queryFn: () => api.get<PublicHoliday[]>("/public-holidays") });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["public-holidays"] });

  const addM = useMutation({
    mutationFn: () => api.post("/public-holidays", { date: dayjs(date).format("YYYY-MM-DD"), name: name.trim() }),
    onSuccess: () => { invalidate(); setDate(null); setName(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/public-holidays/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Title order={4}>Public holidays</Title>
      <Text size="sm" c="dimmed">Work on these dates is paid at the public-holiday rate.</Text>
      <Group align="flex-end">
        <DateInput label="Date" w={170} value={date} onChange={setDate} valueFormat="D MMM YYYY" />
        <TextInput label="Name" placeholder="e.g. New Year's Day" value={name} style={{ flex: 1 }}
          onChange={(e) => setName(e.currentTarget.value)} />
        <Button loading={addM.isPending} disabled={!date || !name.trim()} onClick={() => addM.mutate()}>Add</Button>
      </Group>
      <Table striped withTableBorder fz="sm">
        <Table.Tbody>
          {(q.data ?? []).length === 0 && (
            <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" size="sm">None set.</Text></Table.Td></Table.Tr>
          )}
          {(q.data ?? []).map((h) => (
            <Table.Tr key={h.id}>
              <Table.Td w={140}>{dayjs(h.date).format("D MMM YYYY")}</Table.Td>
              <Table.Td>{h.name}</Table.Td>
              <Table.Td w={40}>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delM.mutate(h.id)}>
                  <IconX size={12} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
