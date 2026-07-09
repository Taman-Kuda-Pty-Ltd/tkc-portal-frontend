import { Anchor, Badge, Button, Card, Group, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Horse, HorseType } from "../api/types";

const TYPE_META: Record<HorseType, { label: string; color: string }> = {
  school: { label: "School", color: "blue" },
  agisted: { label: "Agisted", color: "grape" },
  visiting: { label: "Visiting", color: "teal" },
};

export function HorseTypeBadge({ type }: { type: HorseType }) {
  const m = TYPE_META[type];
  return <Badge color={m.color} variant="light">{m.label}</Badge>;
}

export function HorsesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<HorseType>("school");
  const q = useQuery({ queryKey: ["horses"], queryFn: () => api.get<Horse[]>("/horses") });

  const addM = useMutation({
    mutationFn: () => api.post("/horses", { name: name.trim(), type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["horses"] });
      setName("");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="md" maw={720} w="100%" mx="auto">
      <Title order={2}>Horses</Title>
      <Text size="sm" c="dimmed">
        The horses at the club — school horses plus agisted and visiting horses. Open a
        horse for its full record: identity, owner, suitability, and health &amp; care.
      </Text>

      <Group align="flex-end">
        <TextInput label="Name" placeholder="Add a horse…" value={name} style={{ flex: 1 }}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && addM.mutate()} />
        <Select label="Type" data={[
          { value: "school", label: "School" },
          { value: "agisted", label: "Agisted" },
          { value: "visiting", label: "Visiting" },
        ]} value={type} onChange={(v) => v && setType(v as HorseType)} w={140} />
        <Button loading={addM.isPending} disabled={!name.trim()} onClick={() => addM.mutate()}>
          Add
        </Button>
      </Group>

      <Stack gap={6}>
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No horses yet.</Text>}
        {(q.data ?? []).map((h) => (
          <Card key={h.id} withBorder padding="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Anchor component={Link} to={`/horses/${h.id}`} fw={600}>{h.name}</Anchor>
                <HorseTypeBadge type={h.type} />
                {h.do_not_ride && <Badge color="red" variant="light">Do not ride</Badge>}
                {!h.is_active && <Badge color="gray" variant="light">Inactive</Badge>}
              </Group>
              <Anchor component={Link} to={`/horses/${h.id}`} size="sm">Open record →</Anchor>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
