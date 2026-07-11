import {
  ActionIcon, Anchor, Button, Card, Checkbox, Divider, Group, Select, SimpleGrid, Stack,
  Text, TextInput, Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AccountCreated, PersonMatch } from "../api/types";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { DateField } from "../components/DateField";
import { PhoneField } from "../components/PhoneField";
import { GENDERS, PersonSearchSelect, RiderFields, emptyRider, riderPayload, validateRider } from "../components/riderForm";
import type { RiderDraft } from "../components/riderForm";

interface Address {
  line1: string;
  line2: string;
  line3: string;
  suburb: string;
  state: string;
  postcode: string;
}
const emptyAddress = (): Address => ({ line1: "", line2: "", line3: "", suburb: "", state: "", postcode: "" });

interface HolderDraft {
  mode: "new" | "existing";
  person: PersonMatch | null;
  given_name: string;
  family_name: string;
  email: string;
  mobile: string;
  date_of_birth: Date | null;
  gender: string | null;
  address: Address;
}

export function NewAccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [holder, setHolder] = useState<HolderDraft>({
    mode: "new", person: null, given_name: "", family_name: "", email: "", mobile: "",
    date_of_birth: null, gender: null, address: emptyAddress(),
  });
  const [ec, setEc] = useState({ name: "", relationship: "", phone: "" });
  const [alsoRides, setAlsoRides] = useState(false);
  const [holderRider, setHolderRider] = useState<RiderDraft>(emptyRider({ is_holder: true, relationship: "self" }));
  const [riders, setRiders] = useState<RiderDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const holderName = (holder.mode === "existing" ? holder.person?.name : `${holder.given_name} ${holder.family_name}`.trim()) || "the account holder";
  const setHolderP = (patch: Partial<HolderDraft>) => setHolder((h) => ({ ...h, ...patch }));
  const updateRider = (i: number, patch: Partial<RiderDraft>) => setRiders((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const createM = useMutation({
    mutationFn: () => {
      const students = [
        ...(alsoRides ? [riderPayload({ ...holderRider, is_holder: true })] : []),
        ...riders.map(riderPayload),
      ];
      return api.post<AccountCreated>("/accounts", {
        holder: {
          person_id: holder.mode === "existing" ? holder.person?.id : null,
          given_name: holder.given_name.trim() || null,
          family_name: holder.family_name.trim() || null,
          email: holder.email.trim() || null,
          mobile: holder.mobile || null,
          date_of_birth: holder.date_of_birth ? dayjs(holder.date_of_birth).format("YYYY-MM-DD") : null,
          gender: holder.gender,
          address:
            holder.mode === "new" && (holder.address.line1 || holder.address.suburb) ? holder.address : null,
          emergency_contact: { name: ec.name.trim(), relationship: ec.relationship.trim() || null, phone: ec.phone || null },
        },
        students,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["account-holders"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      notifications.show({ color: "teal", message: "Account created." });
      navigate("/people");
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    setError(null);
    if (holder.mode === "existing" && !holder.person) return setError("Search for and choose the account holder, or add a new one.");
    if (holder.mode === "new" && (!holder.given_name.trim() || !holder.family_name.trim())) return setError("Enter the account holder's first and last name.");
    if (!ec.name.trim()) return setError("An emergency contact name is required.");
    if (alsoRides) {
      const holderDob = holder.mode === "existing" ? holder.person?.date_of_birth ?? null : holder.date_of_birth;
      const err = validateRider({ ...holderRider, is_holder: true, person_dob: holderDob ? String(holderDob) : null });
      if (err) return setError(err);
    }
    if (!alsoRides && riders.length === 0) return setError("Add at least one rider, or tick 'holder also rides'.");
    for (const r of riders) {
      const err = validateRider(r);
      if (err) return setError(err);
    }
    createM.mutate();
  }

  const holderDobForRider = holder.mode === "existing" ? (holder.person?.date_of_birth ?? null) : (holder.date_of_birth ? dayjs(holder.date_of_birth).format("YYYY-MM-DD") : null);

  return (
    <Stack maw={760} w="100%" mx="auto">
      <Group gap="xs">
        <Anchor onClick={() => navigate("/people")} c="dimmed">
          <Group gap={4}><IconArrowLeft size={16} /> People</Group>
        </Anchor>
        <Title order={2}>New account</Title>
      </Group>
      <Text c="dimmed" size="sm">
        Create an account holder and the riders on their account in one go.
      </Text>

      <Card withBorder>
        <Title order={4} mb="sm">Account holder</Title>
        <Group gap="xs" mb="sm">
          <Button size="xs" variant={holder.mode === "existing" ? "filled" : "light"}
            onClick={() => setHolderP({ mode: "existing" })}>Search existing</Button>
          <Button size="xs" variant={holder.mode === "new" ? "filled" : "light"}
            onClick={() => setHolderP({ mode: "new", person: null })}>Add new</Button>
        </Group>

        {holder.mode === "existing" ? (
          <PersonSearchSelect label="Find the account holder" value={holder.person}
            onPick={(p) => setHolderP({ person: p })} />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="First name" required value={holder.given_name}
              onChange={(e) => setHolderP({ given_name: e.currentTarget.value })} />
            <TextInput label="Last name" required value={holder.family_name}
              onChange={(e) => setHolderP({ family_name: e.currentTarget.value })} />
            <TextInput label="Email" value={holder.email}
              onChange={(e) => setHolderP({ email: e.currentTarget.value })} />
            <PhoneField label="Mobile" value={holder.mobile} onChange={(v) => setHolderP({ mobile: v })} />
            <DateField label="Date of birth" value={holder.date_of_birth}
              onChange={(d) => setHolderP({ date_of_birth: d })} />
            <Select label="Gender" data={GENDERS} value={holder.gender}
              onChange={(v) => setHolderP({ gender: v })} clearable comboboxProps={{ withinPortal: true }} />
          </SimpleGrid>
        )}

        {holder.mode === "new" && (
          <>
            <Divider my="md" label="Address (optional)" labelPosition="left" />
            <Stack gap="sm">
              <AddressAutocomplete value={holder.address.line1}
                onChange={(line1) => setHolderP({ address: { ...holder.address, line1 } })}
                onSelect={(p) => setHolderP({ address: { ...holder.address, line1: p.line1, line2: p.line2 || holder.address.line2, suburb: p.suburb, state: p.state, postcode: p.postcode } })} />
              <TextInput label="Address line 2" value={holder.address.line2}
                onChange={(e) => setHolderP({ address: { ...holder.address, line2: e.currentTarget.value } })} />
              <TextInput label="Address line 3" value={holder.address.line3}
                onChange={(e) => setHolderP({ address: { ...holder.address, line3: e.currentTarget.value } })} />
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput label="Suburb" value={holder.address.suburb}
                  onChange={(e) => setHolderP({ address: { ...holder.address, suburb: e.currentTarget.value } })} />
                <TextInput label="State" value={holder.address.state}
                  onChange={(e) => setHolderP({ address: { ...holder.address, state: e.currentTarget.value } })} />
                <TextInput label="Postcode" value={holder.address.postcode}
                  onChange={(e) => setHolderP({ address: { ...holder.address, postcode: e.currentTarget.value } })} />
              </SimpleGrid>
            </Stack>
          </>
        )}

        <Divider my="md" label="Emergency contact (required)" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Name" required value={ec.name} onChange={(e) => setEc({ ...ec, name: e.currentTarget.value })} />
          <TextInput label="Relationship" value={ec.relationship} onChange={(e) => setEc({ ...ec, relationship: e.currentTarget.value })} />
          <PhoneField label="Phone" value={ec.phone} onChange={(v) => setEc({ ...ec, phone: v })} />
        </SimpleGrid>

        <Checkbox mt="md" checked={alsoRides} onChange={(e) => setAlsoRides(e.currentTarget.checked)}
          label="The account holder also rides (add them as a rider)" />
      </Card>

      {alsoRides && (
        <Card withBorder>
          <Text fw={600} mb="xs">{holderName} — rider details</Text>
          <RiderFields
            rider={{ ...holderRider, is_holder: true, person_dob: holderDobForRider ? String(holderDobForRider) : null }}
            update={(patch) => setHolderRider((r) => ({ ...r, ...patch }))}
            holderName={holderName} holderPhone={holder.mobile} holderEmail={holder.email} />
        </Card>
      )}

      <Group justify="space-between">
        <Title order={4}>Riders</Title>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
          onClick={() => setRiders([...riders, emptyRider()])}>Add rider</Button>
      </Group>
      {riders.length === 0 && <Text size="sm" c="dimmed">Add each person who'll take lessons on this account.</Text>}

      {riders.map((r, i) => (
        <Card key={r.key} withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>{r.mode === "existing" ? r.given_name || `Rider ${i + 1}` : r.given_name || `Rider ${i + 1}`}</Text>
            <ActionIcon color="red" variant="subtle" aria-label="Remove rider"
              onClick={() => setRiders(riders.filter((_, idx) => idx !== i))}>
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <RiderFields rider={r} update={(patch) => updateRider(i, patch)}
            holderName={holderName} holderPhone={holder.mobile} holderEmail={holder.email} />
        </Card>
      ))}

      {error && <Text c="red">{error}</Text>}
      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate("/people")}>Cancel</Button>
        <Button loading={createM.isPending} onClick={submit}>Create account</Button>
      </Group>
    </Stack>
  );
}
