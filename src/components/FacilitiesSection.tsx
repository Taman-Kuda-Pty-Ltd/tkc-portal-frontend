import { ActionIcon, Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AddressAutocomplete } from "./AddressAutocomplete";

interface Facility {
  id: number;
  name: string;
  position: number;
  is_active: boolean;
  line1: string | null;
  line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
}

interface Address {
  line1: string;
  line2: string;
  suburb: string;
  state: string;
  postcode: string;
}
const emptyAddress = (): Address => ({ line1: "", line2: "", suburb: "", state: "", postcode: "" });
const fromFacility = (f: Facility): Address => ({
  line1: f.line1 ?? "", line2: f.line2 ?? "", suburb: f.suburb ?? "", state: f.state ?? "", postcode: f.postcode ?? "",
});
// Empty strings -> null so a blank field clears rather than storing "".
const addressPayload = (a: Address) => ({
  line1: a.line1.trim() || null, line2: a.line2.trim() || null, suburb: a.suburb.trim() || null,
  state: a.state.trim() || null, postcode: a.postcode.trim() || null,
});

// The line2 + suburb/state/postcode block, shared by add + edit.
function AddressBlock({ address, set }: { address: Address; set: (a: Address) => void }) {
  return (
    <>
      <AddressAutocomplete value={address.line1}
        onChange={(line1) => set({ ...address, line1 })}
        onSelect={(p) => set({ ...address, line1: p.line1, suburb: p.suburb, state: p.state, postcode: p.postcode })} />
      <TextInput label="Address line 2" value={address.line2}
        onChange={(e) => set({ ...address, line2: e.currentTarget.value })} />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput label="Suburb" value={address.suburb} onChange={(e) => set({ ...address, suburb: e.currentTarget.value })} />
        <TextInput label="State" value={address.state} onChange={(e) => set({ ...address, state: e.currentTarget.value })} />
        <TextInput label="Postcode" value={address.postcode} onChange={(e) => set({ ...address, postcode: e.currentTarget.value })} />
      </SimpleGrid>
    </>
  );
}

export function FacilitiesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress());
  const [editing, setEditing] = useState<Facility | null>(null);
  const q = useQuery({ queryKey: ["facilities"], queryFn: () => api.get<Facility[]>("/facilities") });

  const createM = useMutation({
    mutationFn: () => api.post("/facilities", { name: name.trim(), ...addressPayload(address) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facilities"] });
      setName("");
      setAddress(emptyAddress());
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">Places a lesson can run (arena, roundyard, trail…).</Text>
      <Card withBorder padding="sm">
        <Stack gap="sm">
          <TextInput label="New facility" placeholder="e.g. Indoor arena" value={name}
            onChange={(e) => setName(e.currentTarget.value)} />
          <Text size="xs" c="dimmed">Address (optional)</Text>
          <AddressBlock address={address} set={setAddress} />
          <Group justify="flex-end">
            <Button loading={createM.isPending} disabled={!name.trim()} onClick={() => createM.mutate()}>Add</Button>
          </Group>
        </Stack>
      </Card>
      <Stack gap="xs">
        {(q.data ?? []).map((f) => (
          <Card key={f.id} withBorder padding="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600} c={f.is_active ? undefined : "dimmed"}>{f.name}</Text>
                {!f.is_active && <Badge variant="light" color="gray">Inactive</Badge>}
                {f.suburb && <Text size="xs" c="dimmed">{[f.suburb, f.state].filter(Boolean).join(" ")}</Text>}
              </Group>
              <ActionIcon variant="subtle" aria-label="Edit" onClick={() => setEditing(f)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Group>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && <Text size="sm" c="dimmed">No facilities yet.</Text>}
      </Stack>
      {editing && <FacilityModal facility={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

function FacilityModal({ facility, onClose }: { facility: Facility; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(facility.name);
  const [active, setActive] = useState(facility.is_active);
  const [address, setAddress] = useState<Address>(fromFacility(facility));
  useEffect(() => {
    setName(facility.name);
    setActive(facility.is_active);
    setAddress(fromFacility(facility));
  }, [facility]);
  const done = () => { qc.invalidateQueries({ queryKey: ["facilities"] }); onClose(); };

  const saveM = useMutation({
    mutationFn: () => api.patch(`/facilities/${facility.id}`, { name: name.trim(), is_active: active, ...addressPayload(address) }),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => api.del(`/facilities/${facility.id}`),
    onSuccess: done,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title="Edit facility">
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <AddressBlock address={address} set={setAddress} />
        <Switch label="Active" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
        <Group justify="space-between" mt="sm">
          <Button variant="light" color="red" loading={delM.isPending} onClick={() => delM.mutate()}>Delete</Button>
          <Button loading={saveM.isPending} disabled={!name.trim()} onClick={() => saveM.mutate()}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
