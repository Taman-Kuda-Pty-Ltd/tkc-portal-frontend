import { ActionIcon, Button, Group, NumberInput, Stack, Table, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";

interface SuperRate { id: number; percent: number; from_date: string }

/** The org-wide default super guarantee %, effective-dated (latest date wins, so
 *  coverage is continuous with no overlap). A person can override it on their profile. */
export function SuperRatesSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["super-rates"], queryFn: () => api.get<SuperRate[]>("/super-rates") });
  const [percent, setPercent] = useState<number>(11.5);
  const [from, setFrom] = useState<Date | null>(new Date());
  const invalidate = () => qc.invalidateQueries({ queryKey: ["super-rates"] });

  const addM = useMutation({
    mutationFn: () => api.post("/super-rates", { percent, from_date: dayjs(from).format("YYYY-MM-DD") }),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/super-rates/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="xs">
      <Title order={4}>Default super rate</Title>
      <Text size="sm" c="dimmed">
        The super guarantee % applied to employees, effective-dated — the latest date on or
        before a pay period is used. A person can override this on their profile.
      </Text>
      <Table striped withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr><Table.Th>Rate</Table.Th><Table.Th>From</Table.Th><Table.Th /></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).length === 0 && (
            <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" size="sm">None set — super won't be calculated.</Text></Table.Td></Table.Tr>
          )}
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{r.percent}%</Table.Td>
              <Table.Td>from {dayjs(r.from_date).format("D MMM YYYY")}</Table.Td>
              <Table.Td>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delM.mutate(r.id)}><IconX size={12} /></ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group align="flex-end" gap="xs">
        <NumberInput label="Rate %" w={110} min={0} max={100} step={0.5} value={percent}
          onChange={(v) => setPercent(Number(v) || 0)} />
        <DateInput label="Effective from" w={150} value={from} onChange={setFrom} valueFormat="D MMM YYYY" />
        <Button size="sm" variant="light" loading={addM.isPending} disabled={!from} onClick={() => addM.mutate()}>Add</Button>
      </Group>
    </Stack>
  );
}
