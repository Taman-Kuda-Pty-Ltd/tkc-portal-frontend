import {
  ActionIcon, Alert, Anchor, Autocomplete, Badge, Button, Card, Divider, Group, NumberInput,
  Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput, Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DateField } from "../components/DateField";
import { FileUpload, useStorageStatus } from "../components/FileUpload";
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

// Free-text with common suggestions (Autocomplete) — the field still accepts anything,
// so an unusual breed/colour isn't blocked (UAT#3 HORSE-BREED-COLR judgment call).
const BREED_SUGGESTIONS = [
  "Australian Stock Horse", "Thoroughbred", "Standardbred", "Quarter Horse", "Warmblood",
  "Arabian", "Welsh Pony", "Australian Pony", "Riding Pony", "Shetland Pony", "Connemara",
  "Clydesdale", "Appaloosa", "Paint", "Andalusian", "Crossbred", "Pony (unspecified)",
];
const COLOUR_SUGGESTIONS = [
  "Bay", "Dark Bay", "Black", "Brown", "Chestnut", "Liver Chestnut", "Grey", "Palomino",
  "Buckskin", "Dun", "Roan", "Cremello", "Piebald", "Skewbald", "Pinto", "White",
];

const toISO = (d: Date | null) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
const fromISO = (s: string | null) => (s ? dayjs(s).toDate() : null);

export function HorseDetailPage() {
  const { id } = useParams();
  const horseId = Number(id);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["horse", horseId], queryFn: () => api.get<Horse>(`/horses/${horseId}`) });
  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });

  const storageReady = useStorageStatus();
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
          <Autocomplete label="Breed" data={BREED_SUGGESTIONS} value={h.breed ?? ""}
            onChange={(v) => set({ breed: v })} placeholder="Type or pick" />
          <Autocomplete label="Colour" data={COLOUR_SUGGESTIONS} value={h.colour ?? ""}
            onChange={(v) => set({ colour: v })} placeholder="Type or pick" />
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
          <Textarea label="Disciplines" autosize minRows={2} value={h.disciplines ?? ""}
            onChange={(e) => set({ disciplines: e.currentTarget.value })} />
          <Textarea label="Temperament" autosize minRows={2} value={h.temperament ?? ""}
            onChange={(e) => set({ temperament: e.currentTarget.value })} />
        </SimpleGrid>
        <Switch mt="md" label="Do not ride" checked={h.do_not_ride ?? false}
          onChange={(e) => set({ do_not_ride: e.currentTarget.checked })} />
        {h.do_not_ride && (
          <Textarea mt="sm" label="Reason" autosize minRows={1} value={h.do_not_ride_note ?? ""}
            onChange={(e) => set({ do_not_ride_note: e.currentTarget.value })} />
        )}
      </Card>

      {/* Photo & documents */}
      <Title order={4} mt="sm">Photo &amp; documents</Title>
      <Card withBorder>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <FileUpload
            scope="horse_photo"
            recordId={horseId}
            attachPath={`/horses/${horseId}/photo`}
            urlPath={`/horses/${horseId}/photo-url`}
            removePath={`/horses/${horseId}/photo`}
            invalidateKey={["horse", horseId]}
            storageReady={storageReady}
            variant="avatar"
            crop="circle"
            label="Photo"
            size={160}
          />
          <div>
            <FileUpload
              scope="horse_document"
              recordId={horseId}
              attachPath={`/horses/${horseId}/document`}
              urlPath={`/horses/${horseId}/document-url`}
              removePath={`/horses/${horseId}/document`}
              invalidateKey={["horse", horseId]}
              storageReady={storageReady}
              variant="document"
              label="Document (registration, passport, vet certificate…)"
            />
          </div>
        </SimpleGrid>
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

      {/* Farrier / dental / vaccination — latest + full history */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {PLACEHOLDER_TYPES.map((p) => (
          <PlaceholderCarePanel key={p.type} horseId={horseId} type={p.type} label={p.label}
            latest={latest(p.type)} records={records.filter((r) => r.care_type === p.type)}
            onChange={invalidate} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

/** Delete a care record after an explicit confirm (records were previously
 *  irreversible — UAT#3 HCARE-EDIT). */
function useDeleteCare(horseId: number, onChange: () => void) {
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/horses/${horseId}/care/${id}`),
    onSuccess: () => { onChange(); notifications.show({ color: "gray", message: "Record deleted" }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (r: HorseCare) => {
    if (window.confirm(`Delete this ${r.care_type} record from ${dayjs(r.performed_on).format("D MMM YYYY")}? This can't be undone.`))
      delM.mutate(r.id);
  };
}

function WormingPanel({ horseId, latest, records, onChange }: {
  horseId: number; latest?: HorseCare; records: HorseCare[]; onChange: () => void;
}) {
  const [product, setProduct] = useState("");
  const [weeks, setWeeks] = useState<number | string>(12);
  const [when, setWhen] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState("");
  const confirmDelete = useDeleteCare(horseId, onChange);

  const addM = useMutation({
    mutationFn: () => api.post(`/horses/${horseId}/care`, {
      care_type: "worming",
      performed_on: toISO(when),
      product_name: product.trim() || null,
      effective_weeks: weeks === "" ? null : Number(weeks),
      notes: notes.trim() || null,
    }),
    onSuccess: () => {
      setProduct(""); setNotes(""); onChange();
      notifications.show({ color: "teal", message: "Worming recorded" });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Prominent next-due callout (UAT#3 HWORM-PROM): an alert when overdue/due-soon,
  // a clear line when up to date.
  let status: React.ReactNode = <Text size="sm" c="dimmed">No worming recorded yet.</Text>;
  if (latest?.next_due) {
    const due = dayjs(latest.next_due);
    const overdue = due.isBefore(dayjs(), "day");
    const soon = !overdue && due.diff(dayjs(), "day") <= 14;
    const color = overdue ? "red" : soon ? "orange" : "teal";
    status = (
      <Alert color={color} variant={overdue || soon ? "filled" : "light"}
        icon={overdue || soon ? <IconAlertTriangle size={18} /> : undefined} py={8}>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={700} size="sm">
              {overdue ? `Worming OVERDUE — was due ${due.format("D MMM YYYY")}`
                : soon ? `Worming due soon — ${due.format("D MMM YYYY")}`
                : `Next worming due ${due.format("D MMM YYYY")}`}
            </Text>
            <Text size="xs" opacity={0.9}>
              Last done {dayjs(latest.performed_on).format("D MMM YYYY")}
              {latest.product_name ? ` · ${latest.product_name}` : ""}
            </Text>
          </div>
        </Group>
      </Alert>
    );
  }

  return (
    <Card withBorder>
      <Text fw={600} mb={6}>Worming</Text>
      {status}
      <Divider my="sm" />
      <Group align="flex-end">
        <TextInput label="Product" placeholder="e.g. Equimax" value={product} style={{ flex: 1 }}
          onChange={(e) => setProduct(e.currentTarget.value)} />
        <NumberInput label="Effective (weeks)" w={130} min={1} value={weeks} onChange={setWeeks} />
        <DateField label="Date given" value={when} onChange={(d) => setWhen(d as Date | null)} />
        <Button loading={addM.isPending} disabled={!when} onClick={() => addM.mutate()}>Record</Button>
      </Group>
      <Textarea mt="xs" label="Comments" autosize minRows={1} value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)} placeholder="Optional notes for this treatment" />
      {records.length > 0 && (
        <>
          <Text size="xs" fw={500} mt="sm" c="dimmed">History</Text>
          <Stack gap={2} mt={4}>
            {records.slice().sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1)).map((r) => (
              <Group key={r.id} gap={6} wrap="nowrap" justify="space-between">
                <Text size="xs" c="dimmed">
                  {dayjs(r.performed_on).format("D MMM YYYY")}
                  {r.product_name ? ` — ${r.product_name}` : ""}
                  {r.next_due ? ` (next due ${dayjs(r.next_due).format("D MMM YYYY")})` : ""}
                  {r.notes ? ` · ${r.notes}` : ""}
                </Text>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => confirmDelete(r)}>
                  <IconTrash size={13} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </>
      )}
    </Card>
  );
}

function PlaceholderCarePanel({ horseId, type, label, latest, records, onChange }: {
  horseId: number; type: HorseCareType; label: string; latest?: HorseCare; records: HorseCare[]; onChange: () => void;
}) {
  const [when, setWhen] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState("");
  const confirmDelete = useDeleteCare(horseId, onChange);
  const addM = useMutation({
    mutationFn: () => api.post(`/horses/${horseId}/care`,
      { care_type: type, performed_on: toISO(when), notes: notes.trim() || null }),
    onSuccess: () => { setNotes(""); onChange(); notifications.show({ color: "teal", message: `${label} recorded` }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Card withBorder padding="sm">
      <Text fw={600} size="sm">{label}</Text>
      <Text size="xs" c="dimmed" mb={6}>
        {latest ? `Last done ${dayjs(latest.performed_on).format("D MMM YYYY")}` : "Not recorded"}
      </Text>
      <DateField label="Last done" size="xs" value={when} onChange={(d) => setWhen(d as Date | null)} />
      <TextInput label="Comments" size="xs" mt={4} value={notes} placeholder="Optional"
        onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button size="xs" variant="light" mt={6} fullWidth loading={addM.isPending} disabled={!when}
        onClick={() => addM.mutate()}>Record</Button>
      {records.length > 0 && (
        <Stack gap={2} mt={6}>
          {records.slice().sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1)).map((r) => (
            <Group key={r.id} gap={4} wrap="nowrap" justify="space-between">
              <Text size="xs" c="dimmed">
                {dayjs(r.performed_on).format("D MMM YYYY")}{r.notes ? ` · ${r.notes}` : ""}
              </Text>
              <ActionIcon size="xs" color="red" variant="subtle" onClick={() => confirmDelete(r)}>
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}
