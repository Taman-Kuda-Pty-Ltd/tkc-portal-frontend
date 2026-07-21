import {
  ActionIcon, Alert, Anchor, Autocomplete, Badge, Button, Card, Divider, FileButton, Group, NumberInput,
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
import type { Horse, HorseCare, Person, RiderLevel } from "../api/types";
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
  // HORSE-EDIT-GATING: the record opens read-only; changes need an explicit "Edit horse".
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Horse>>({});
  // Keep the form in sync with server data while NOT editing (view == the read-only form).
  useEffect(() => { if (q.data && !editing) setDraft(q.data); }, [q.data, editing]);
  const set = (patch: Partial<Horse>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = editing && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data);

  // Unsaved-changes warning on navigate/close-away (mirrors the person page intent).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveM = useMutation({
    mutationFn: () => api.patch(`/horses/${horseId}`, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["horse", horseId] });
      qc.invalidateQueries({ queryKey: ["horses"] });
      setEditing(false);
      notifications.show({ color: "teal", message: "Saved" });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const cancelEdit = () => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    if (q.data) setDraft(q.data);
    setEditing(false);
  };

  if (q.isLoading || !q.data) return <Text c="dimmed">Loading…</Text>;
  const h = draft;
  const ro = !editing;
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
        {editing ? (
          <Group gap="xs">
            <Button variant="default" onClick={cancelEdit}>Cancel</Button>
            <Button loading={saveM.isPending} disabled={!dirty} onClick={() => saveM.mutate()}>Save changes</Button>
          </Group>
        ) : (
          <Button variant="light" onClick={() => setEditing(true)}>Edit horse</Button>
        )}
      </Group>

      {/* All horse fields are gated read-only until "Edit horse" (HORSE-EDIT-GATING). A
          disabled fieldset natively disables every control inside it. */}
      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, minInlineSize: "auto" }}>
      <Stack>
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

      </Stack>
      </fieldset>

      {/* Photo & documents — outside the edit fieldset so viewing/downloading always
          works; uploads are gated by canEdit. */}
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
            canEdit={editing}
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
              canEdit={editing}
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

// WORMER-DROPDOWN: common wormer products with their effective window (weeks). Custom
// entry stays possible via the free-text Autocomplete.
const WORMER_PRODUCTS: { value: string; weeks: number }[] = [
  { value: "Equimax", weeks: 12 },
  { value: "Equest", weeks: 13 },
  { value: "Equest Plus Tape", weeks: 13 },
  { value: "Panacur", weeks: 8 },
  { value: "Strategy-T", weeks: 8 },
  { value: "Ammo", weeks: 8 },
  { value: "WSD Allwormer", weeks: 8 },
];

// Built-in care types (the log is extensible — "Other" captures anything else).
const CARE_TYPES: { value: string; label: string }[] = [
  { value: "worming", label: "Worming" },
  { value: "farrier", label: "Farrier" },
  { value: "dental", label: "Dental" },
  { value: "vaccination", label: "Vaccination" },
  { value: "bodywork", label: "Bodywork / physio" },
  { value: "vet", label: "Vet" },
  { value: "other", label: "Other" },
];
const careLabel = (t: string) =>
  CARE_TYPES.find((c) => c.value === t)?.label ?? (t ? t[0].toUpperCase() + t.slice(1) : "Care");

/** Delete a care record after an explicit confirm. */
function useDeleteCare(horseId: number, onChange: () => void) {
  const delM = useMutation({
    mutationFn: (id: number) => api.del(`/horses/${horseId}/care/${id}`),
    onSuccess: () => { onChange(); notifications.show({ color: "gray", message: "Record deleted" }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (r: HorseCare) => {
    if (window.confirm(`Delete this ${careLabel(r.care_type)} record from ${dayjs(r.performed_on).format("D MMM YYYY")}? This can't be undone.`))
      delM.mutate(r.id);
  };
}

/** HORSE-CARE-MODEL: one chronological, extensible care log for a horse. Any record can
 *  carry an optional next-due date that surfaces here (and in Approvals); worming keeps
 *  its product + effective-weeks convenience that derives next-due automatically. */
function HealthAndCare({ horseId }: { horseId: number }) {
  const qc = useQueryClient();
  const careQ = useQuery({ queryKey: ["horse-care", horseId], queryFn: () => api.get<HorseCare[]>(`/horses/${horseId}/care`) });
  const records = (careQ.data ?? []).slice().sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1));
  const confirmDelete = useDeleteCare(horseId, () => invalidate());

  const [type, setType] = useState("worming");
  const [customType, setCustomType] = useState("");
  const [product, setProduct] = useState("");
  const [weeks, setWeeks] = useState<number | string>(12);
  const [when, setWhen] = useState<Date | null>(new Date());
  const [nextDue, setNextDue] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [attachmentKey, setAttachmentKey] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const isWorming = type === "worming";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["horse-care", horseId] });
    qc.invalidateQueries({ queryKey: ["horse-care-due-count"] });
    qc.invalidateQueries({ queryKey: ["horse-care-due"] });
  };

  // FU-CARE-ATTACH: upload a scan/receipt (JPG/PDF) to the bucket now, keep its key, and
  // attach it when the care record is created.
  async function pickAttachment(file: File) {
    setUploading(true);
    try {
      const presign = await api.post<{ url: string; key: string }>("/storage/presign-upload", {
        scope: "horse_care_document", record_id: horseId, filename: file.name || "upload",
      });
      const put = await fetch(presign.url, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      setAttachmentKey(presign.key);
      setAttachmentName(file.name);
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const addM = useMutation({
    mutationFn: () => api.post(`/horses/${horseId}/care`, {
      care_type: (type === "other" ? customType.trim() || "other" : type),
      performed_on: toISO(when),
      notes: notes.trim() || null,
      next_due: !isWorming && nextDue ? toISO(nextDue) : null,
      product_name: isWorming ? (product.trim() || null) : null,
      effective_weeks: isWorming && weeks !== "" ? Number(weeks) : null,
      attachment_key: attachmentKey,
    }),
    onSuccess: () => {
      setProduct(""); setNotes(""); setNextDue(null); setCustomType("");
      setAttachmentKey(null); setAttachmentName(null);
      invalidate();
      notifications.show({ color: "teal", message: "Care record added" });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Next-due callouts: the latest record of each type whose next-due is overdue/soon.
  const seen = new Set<string>();
  const dueCallouts = records.filter((r) => {
    if (seen.has(r.care_type)) return false;
    seen.add(r.care_type);
    return r.next_due != null;
  }).filter((r) => dayjs(r.next_due!).diff(dayjs(), "day") <= 14)
    .sort((a, b) => (a.next_due! < b.next_due! ? -1 : 1));

  return (
    <Stack>
      <Title order={4}>Health &amp; care</Title>

      {dueCallouts.map((r) => {
        const due = dayjs(r.next_due!);
        const overdue = due.isBefore(dayjs(), "day");
        return (
          <Alert key={`due-${r.id}`} color={overdue ? "red" : "orange"} variant="filled"
            icon={<IconAlertTriangle size={18} />} py={8}>
            <Text fw={700} size="sm">
              {careLabel(r.care_type)} {overdue ? "OVERDUE" : "due soon"} — {overdue ? "was due" : ""} {due.format("D MMM YYYY")}
            </Text>
            <Text size="xs" opacity={0.9}>
              Last done {dayjs(r.performed_on).format("D MMM YYYY")}{r.product_name ? ` · ${r.product_name}` : ""}
            </Text>
          </Alert>
        );
      })}

      {/* Add a care record */}
      <Card withBorder>
        <Text fw={600} mb={6}>Record care</Text>
        <Group align="flex-end" wrap="wrap">
          <Select label="Type" w={170} data={CARE_TYPES} value={type} allowDeselect={false}
            onChange={(v) => v && setType(v)} comboboxProps={{ withinPortal: true }} />
          {type === "other" && (
            <TextInput label="Custom type" placeholder="e.g. Chiropractor" value={customType}
              onChange={(e) => setCustomType(e.currentTarget.value)} style={{ flex: 1, minWidth: 160 }} />
          )}
          <DateField label="Date done" value={when} onChange={(d) => setWhen(d as Date | null)} />
          {!isWorming && (
            <DateField label="Next due (optional)" value={nextDue} clearable
              onChange={(d) => setNextDue(d as Date | null)} />
          )}
        </Group>
        {isWorming && (
          <Group align="flex-end" wrap="wrap" mt="xs">
            <Autocomplete label="Wormer product" placeholder="Pick or type" style={{ flex: 1, minWidth: 180 }}
              data={WORMER_PRODUCTS.map((p) => p.value)} value={product}
              onChange={(v) => {
                setProduct(v);
                const known = WORMER_PRODUCTS.find((p) => p.value === v);
                if (known) setWeeks(known.weeks);
              }} />
            <NumberInput label="Effective (weeks)" w={140} min={1} value={weeks} onChange={setWeeks} />
            <Text size="xs" c="dimmed" pb={8}>Next-due is set automatically.</Text>
          </Group>
        )}
        <Textarea mt="xs" label="Notes" autosize minRows={1} value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)} placeholder="Optional notes for this treatment" />
        <Group justify="space-between" mt="xs">
          <Group gap={6}>
            <FileButton onChange={(f) => f && pickAttachment(f)} accept="image/jpeg,application/pdf">
              {(props) => (
                <Button {...props} size="xs" variant="light" loading={uploading}>
                  {attachmentKey ? "Replace attachment" : "Attach scan/receipt"}
                </Button>
              )}
            </FileButton>
            {attachmentName && (
              <Text size="xs" c="dimmed">{attachmentName}
                <Anchor ml={6} onClick={() => { setAttachmentKey(null); setAttachmentName(null); }}>remove</Anchor>
              </Text>
            )}
          </Group>
          <Button loading={addM.isPending} disabled={!when || uploading} onClick={() => addM.mutate()}>Add record</Button>
        </Group>
      </Card>

      {/* Chronological log */}
      <Card withBorder>
        <Text fw={600} mb={6}>Care log</Text>
        {records.length === 0 ? (
          <Text size="sm" c="dimmed">No care recorded yet.</Text>
        ) : (
          <Stack gap={6}>
            {records.map((r) => {
              const overdue = r.next_due && dayjs(r.next_due).isBefore(dayjs(), "day");
              const soon = r.next_due && !overdue && dayjs(r.next_due).diff(dayjs(), "day") <= 14;
              return (
                <Group key={r.id} gap={8} wrap="nowrap" justify="space-between"
                  style={{ borderBottom: "1px solid var(--mantine-color-default-border)", paddingBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="wrap">
                      <Badge variant="light" size="sm">{careLabel(r.care_type)}</Badge>
                      <Text size="sm" fw={500}>{dayjs(r.performed_on).format("D MMM YYYY")}</Text>
                      {r.product_name && <Text size="sm" c="dimmed">· {r.product_name}</Text>}
                      {r.next_due && (
                        <Text size="xs" c={overdue ? "red" : soon ? "orange" : "dimmed"} fw={overdue || soon ? 700 : 400}>
                          next due {dayjs(r.next_due).format("D MMM YYYY")}
                        </Text>
                      )}
                    </Group>
                    {r.notes && <Text size="xs" c="dimmed">{r.notes}</Text>}
                    {r.attachment_key && (
                      <Anchor size="xs" onClick={async () => {
                        const { url } = await api.get<{ url: string }>(`/horses/${horseId}/care/${r.id}/attachment-url`);
                        window.open(url, "_blank");
                      }}>View attachment</Anchor>
                    )}
                  </div>
                  <ActionIcon size="sm" color="red" variant="subtle" aria-label="Delete record"
                    onClick={() => confirmDelete(r)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              );
            })}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
