import {
  Anchor, Badge, Button, Card, Divider, Group, NumberInput, Select, SimpleGrid,
  Stack, Switch, Text, Textarea, TextInput, Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DateField } from "../components/DateField";
import { api } from "../api/client";
import type { Horse, HorseCare, HorseCareType, Person, RiderLevel } from "../api/types";
import { HorseTypeBadge } from "./HorsesPage";

const LEVELS: { value: RiderLevel; label: string }[] = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const toISO = (d: Date | null) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
const fromISO = (s: string | null) => (s ? dayjs(s).toDate() : null);

export function HorseDetailPage() {
  const { id } = useParams();
  const horseId = Number(id);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["horse", horseId], queryFn: () => api.get<Horse>(`/horses/${horseId}`) });
  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });

  const [draft, setDraft] = useState<Partial<Horse>>({});
  useEffect(() => { if (q.data) setDraft(q.data); }, [q.data]);
  const set = (patch: Partial<Horse>) => setDraft((d) => ({ ...d, ...patch }));

  const saveM = useMutation({
    mutationFn: () => api.patch(`/horses/${horseId}`, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["horse", horseId] });
      qc.invalidateQueries({ queryKey: ["horses"] });
      notifications.show({ color: "teal", message: "Saved" });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading || !q.data) return <Text c="dimmed">Loading…</Text>;
  const h = draft;
  const isOwned = h.type === "agisted" || h.type === "visiting";
  const peopleOpts = (peopleQ.data ?? []).map((p) => ({ value: String(p.id), label: p.full_name }));

  return (
    <Stack maw={760} w="100%" mx="auto">
      <Anchor component={Link} to="/horses" size="sm">← All horses</Anchor>
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <Title order={2}>{q.data.name}</Title>
          {h.type && <HorseTypeBadge type={h.type} />}
          {h.do_not_ride && <Badge color="red" variant="light">Do not ride</Badge>}
          {!h.is_active && <Badge color="gray" variant="light">Inactive</Badge>}
          {h.age_years != null && <Badge variant="outline">{h.age_years} yo</Badge>}
        </Group>
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save changes</Button>
      </Group>

      <Card withBorder>
        <Group>
          <TextInput label="Name" value={h.name ?? ""} onChange={(e) => set({ name: e.currentTarget.value })} style={{ flex: 1 }} />
          <Select label="Type" w={150} data={[
            { value: "school", label: "School" },
            { value: "agisted", label: "Agisted" },
            { value: "visiting", label: "Visiting" },
          ]} value={h.type} onChange={(v) => v && set({ type: v as Horse["type"] })} />
          <Switch label="Active" checked={h.is_active ?? true} mt={24}
            onChange={(e) => set({ is_active: e.currentTarget.checked })} />
        </Group>
      </Card>

      {/* Identity & markings */}
      <Title order={4} mt="sm">Identity &amp; markings</Title>
      <Card withBorder>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Breed" value={h.breed ?? ""} onChange={(e) => set({ breed: e.currentTarget.value })} />
          <TextInput label="Colour" value={h.colour ?? ""} onChange={(e) => set({ colour: e.currentTarget.value })} />
          <Select label="Sex" clearable data={[
            { value: "mare", label: "Mare" }, { value: "gelding", label: "Gelding" },
            { value: "stallion", label: "Stallion" }, { value: "colt", label: "Colt" },
            { value: "filly", label: "Filly" },
          ]} value={h.sex ?? null} onChange={(v) => set({ sex: (v as Horse["sex"]) ?? null })} />
          <DateField label="Date of birth" value={fromISO(h.date_of_birth ?? null)} clearable
            onChange={(d) => set({ date_of_birth: toISO(d as Date | null) })} />
          <NumberInput label="Height (hh)" value={h.height_hh ?? undefined} step={0.1} decimalScale={1}
            onChange={(v) => set({ height_hh: v === "" ? null : Number(v) })} />
          <TextInput label="Microchip" value={h.microchip ?? ""} onChange={(e) => set({ microchip: e.currentTarget.value })} />
          <TextInput label="Brand" value={h.brand ?? ""} onChange={(e) => set({ brand: e.currentTarget.value })} />
          <TextInput label="Registration" value={h.registration ?? ""} onChange={(e) => set({ registration: e.currentTarget.value })} />
        </SimpleGrid>
        <Textarea mt="sm" label="Markings" autosize minRows={2} value={h.markings ?? ""}
          onChange={(e) => set({ markings: e.currentTarget.value })} />
      </Card>

      {/* Owner — agisted/visiting only */}
      {isOwned && (
        <>
          <Title order={4} mt="sm">Owner</Title>
          <Card withBorder>
            <Select label="Owner (a person on file)" clearable searchable data={peopleOpts}
              placeholder="Link to a Person, or use the details below"
              value={h.owner_person_id ? String(h.owner_person_id) : null}
              onChange={(v) => set({ owner_person_id: v ? Number(v) : null })} />
            <Text size="xs" c="dimmed" mt={4}>
              A fuller owner/agistee profile comes later — for now, link a Person or capture a name + contact.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} mt="sm">
              <TextInput label="Owner name" value={h.owner_name ?? ""} onChange={(e) => set({ owner_name: e.currentTarget.value })} />
              <TextInput label="Phone" value={h.owner_phone ?? ""} onChange={(e) => set({ owner_phone: e.currentTarget.value })} />
              <TextInput label="Email" value={h.owner_email ?? ""} onChange={(e) => set({ owner_email: e.currentTarget.value })} />
            </SimpleGrid>
            {h.type === "visiting" && (
              <DateField mt="sm" label="Expected departure" clearable value={fromISO(h.expected_departure ?? null)}
                onChange={(d) => set({ expected_departure: toISO(d as Date | null) })} />
            )}
          </Card>
        </>
      )}

      {/* Suitability */}
      <Title order={4} mt="sm">Suitability</Title>
      <Card withBorder>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput label="Max rider weight (kg)" value={h.max_rider_weight_kg ?? undefined} min={0}
            onChange={(v) => set({ max_rider_weight_kg: v === "" ? null : Number(v) })} />
          <Select label="Rider level — min" clearable data={LEVELS} value={h.rider_level_min ?? null}
            onChange={(v) => set({ rider_level_min: (v as RiderLevel) ?? null })} />
          <Select label="Rider level — max" clearable data={LEVELS} value={h.rider_level_max ?? null}
            onChange={(v) => set({ rider_level_max: (v as RiderLevel) ?? null })} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
          <TextInput label="Disciplines" value={h.disciplines ?? ""} onChange={(e) => set({ disciplines: e.currentTarget.value })} />
          <TextInput label="Temperament" value={h.temperament ?? ""} onChange={(e) => set({ temperament: e.currentTarget.value })} />
        </SimpleGrid>
        <Switch mt="md" label="Do not ride" checked={h.do_not_ride ?? false}
          onChange={(e) => set({ do_not_ride: e.currentTarget.checked })} />
        {h.do_not_ride && (
          <Textarea mt="sm" label="Reason" autosize minRows={1} value={h.do_not_ride_note ?? ""}
            onChange={(e) => set({ do_not_ride_note: e.currentTarget.value })} />
        )}
      </Card>

      {/* Photo & documents — dormant placeholders */}
      <Title order={4} mt="sm">Photo &amp; documents</Title>
      <Card withBorder>
        <Text size="sm" c="dimmed">
          Photo and document uploads will appear here once file storage is set up. Not available yet.
        </Text>
      </Card>

      <Divider my="sm" />
      <HealthAndCare horseId={horseId} />
    </Stack>
  );
}

const PLACEHOLDER_TYPES: { type: HorseCareType; label: string }[] = [
  { type: "farrier", label: "Farrier" },
  { type: "dental", label: "Dental" },
  { type: "vaccination", label: "Vaccination" },
];

function HealthAndCare({ horseId }: { horseId: number }) {
  const qc = useQueryClient();
  const careQ = useQuery({ queryKey: ["horse-care", horseId], queryFn: () => api.get<HorseCare[]>(`/horses/${horseId}/care`) });
  const records = careQ.data ?? [];
  const latest = (t: HorseCareType) =>
    records.filter((r) => r.care_type === t).sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1))[0];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["horse-care", horseId] });
    qc.invalidateQueries({ queryKey: ["horse-care-due-count"] });
    qc.invalidateQueries({ queryKey: ["horse-care-due"] });
  };

  return (
    <Stack>
      <Title order={4}>Health &amp; care</Title>

      {/* Worming — full PoC */}
      <WormingPanel horseId={horseId} latest={latest("worming")}
        records={records.filter((r) => r.care_type === "worming")} onChange={invalidate} />

      {/* Placeholders — last-done only */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {PLACEHOLDER_TYPES.map((p) => (
          <PlaceholderCarePanel key={p.type} horseId={horseId} type={p.type} label={p.label}
            latest={latest(p.type)} onChange={invalidate} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function WormingPanel({ horseId, latest, records, onChange }: {
  horseId: number; latest?: HorseCare; records: HorseCare[]; onChange: () => void;
}) {
  const [product, setProduct] = useState("");
  const [weeks, setWeeks] = useState<number | string>(12);
  const [when, setWhen] = useState<Date | null>(new Date());

  const addM = useMutation({
    mutationFn: () => api.post(`/horses/${horseId}/care`, {
      care_type: "worming",
      performed_on: toISO(when),
      product_name: product.trim() || null,
      effective_weeks: weeks === "" ? null : Number(weeks),
    }),
    onSuccess: () => { setProduct(""); onChange(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  let status: React.ReactNode = <Text size="sm" c="dimmed">No worming recorded yet.</Text>;
  if (latest?.next_due) {
    const due = dayjs(latest.next_due);
    const overdue = due.isBefore(dayjs(), "day");
    const soon = !overdue && due.diff(dayjs(), "day") <= 14;
    status = (
      <Group gap="xs">
        <Text size="sm">Last done {dayjs(latest.performed_on).format("D MMM YYYY")}
          {latest.product_name ? ` · ${latest.product_name}` : ""} · next due {due.format("D MMM YYYY")}</Text>
        <Badge color={overdue ? "red" : soon ? "orange" : "teal"} variant="light">
          {overdue ? "Overdue" : soon ? "Due soon" : "Up to date"}
        </Badge>
      </Group>
    );
  }

  return (
    <Card withBorder>
      <Group justify="space-between">
        <Text fw={600}>Worming</Text>
      </Group>
      <div style={{ marginTop: 6 }}>{status}</div>
      <Divider my="sm" />
      <Group align="flex-end">
        <TextInput label="Product" placeholder="e.g. Equimax" value={product} style={{ flex: 1 }}
          onChange={(e) => setProduct(e.currentTarget.value)} />
        <NumberInput label="Effective (weeks)" w={130} min={1} value={weeks}
          onChange={setWeeks} />
        <DateField label="Date given" value={when} onChange={(d) => setWhen(d as Date | null)} />
        <Button loading={addM.isPending} disabled={!when} onClick={() => addM.mutate()}>Record</Button>
      </Group>
      {records.length > 0 && (
        <Stack gap={2} mt="sm">
          {records.slice().sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1)).map((r) => (
            <Text key={r.id} size="xs" c="dimmed">
              {dayjs(r.performed_on).format("D MMM YYYY")}
              {r.product_name ? ` — ${r.product_name}` : ""}
              {r.next_due ? ` (next due ${dayjs(r.next_due).format("D MMM YYYY")})` : ""}
            </Text>
          ))}
        </Stack>
      )}
    </Card>
  );
}

function PlaceholderCarePanel({ horseId, type, label, latest, onChange }: {
  horseId: number; type: HorseCareType; label: string; latest?: HorseCare; onChange: () => void;
}) {
  const [when, setWhen] = useState<Date | null>(new Date());
  const addM = useMutation({
    mutationFn: () => api.post(`/horses/${horseId}/care`, { care_type: type, performed_on: toISO(when) }),
    onSuccess: onChange,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Card withBorder padding="sm">
      <Text fw={600} size="sm">{label}</Text>
      <Text size="xs" c="dimmed" mb={6}>
        {latest ? `Last done ${dayjs(latest.performed_on).format("D MMM YYYY")}` : "Not recorded"}
      </Text>
      <DateField label="Last done" size="xs" value={when} onChange={(d) => setWhen(d as Date | null)} />
      <Button size="xs" variant="light" mt={6} fullWidth loading={addM.isPending} disabled={!when}
        onClick={() => addM.mutate()}>Record</Button>
    </Card>
  );
}
