import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { EngagementDetail, PersonDetail, Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { PersonRatesSection } from "../components/PersonRatesSection";
import { PhoneField } from "../components/PhoneField";

const TYPE_LABEL: Record<string, string> = {
  employee: "Employee", contractor: "Contractor", volunteer: "Volunteer", other: "Other",
};
const BASIS_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
];
const RESIDENCY_OPTIONS = [
  { value: "resident", label: "Australian resident" },
  { value: "non_resident", label: "Non-resident" },
  { value: "working_holiday_maker", label: "Working holiday maker" },
];
const FUND_OPTIONS = [
  { value: "apra", label: "APRA fund" },
  { value: "smsf", label: "Self-managed (SMSF)" },
];
const CRED_LABEL: Record<string, string> = {
  wwcc: "Working With Children Check", first_aid: "First Aid", coaching: "Coaching accreditation",
  police_check: "Police check", drivers_licence: "Driver's licence", other: "Other",
};
const RELATIONSHIPS = ["Parent", "Guardian", "Spouse", "Partner", "Sibling", "Child", "Friend", "Grandparent", "Other"];
// Keep any pre-existing free-text value selectable so it isn't silently dropped.
const relOptions = (current: string) =>
  current && !RELATIONSHIPS.includes(current) ? [...RELATIONSHIPS, current] : RELATIONSHIPS;

const formatBsb = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
};

interface EngDraft {
  employment_basis: string | null;
  position_title: string;
  start_date: Date | null;
  // business (contractor)
  legal_name: string; trading_name: string; abn: string; gst_registered: boolean;
  // tax (employee)
  tfn: string; tfn_not_provided: boolean; residency: string;
  claim_tax_free_threshold: boolean; has_study_loan: boolean;
  // super (employee)
  fund_type: string; fund_name: string; fund_usi: string; member_number: string;
  esa: string; smsf_bank_bsb: string; smsf_bank_account: string;
  // bank
  account_name: string; bank_name: string; bsb: string; account_number: string;
}

function engToDraft(e: EngagementDetail): EngDraft {
  return {
    employment_basis: e.employment_basis,
    position_title: e.position_title ?? "",
    start_date: e.start_date ? dayjs(e.start_date).toDate() : null,
    legal_name: e.business?.legal_name ?? "", trading_name: e.business?.trading_name ?? "",
    abn: e.business?.abn ?? "", gst_registered: e.business?.gst_registered ?? false,
    tfn: e.tax?.tfn ?? "", tfn_not_provided: e.tax?.tfn_not_provided ?? false,
    residency: e.tax?.residency ?? "resident",
    claim_tax_free_threshold: e.tax?.claim_tax_free_threshold ?? true,
    has_study_loan: e.tax?.has_study_loan ?? false,
    fund_type: e.superannuation?.fund_type ?? "apra", fund_name: e.superannuation?.fund_name ?? "",
    fund_usi: e.superannuation?.fund_usi ?? "", member_number: e.superannuation?.member_number ?? "",
    esa: e.superannuation?.esa ?? "", smsf_bank_bsb: formatBsb(e.superannuation?.smsf_bank_bsb ?? ""),
    smsf_bank_account: e.superannuation?.smsf_bank_account ?? "",
    account_name: e.bank?.account_name ?? "", bank_name: e.bank?.bank_name ?? "",
    bsb: formatBsb(e.bank?.bsb ?? ""), account_number: e.bank?.account_number ?? "",
  };
}

interface EcDraft { name: string; relationship: string; phone: string }

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("manage_people");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    given_name: "", middle_names: "", family_name: "", preferred_name: "",
    dob: null as Date | null, mobile: "", email: "", is_active: true, role_ids: [] as string[],
  });
  const [addr, setAddr] = useState({ line1: "", line2: "", suburb: "", state: "", postcode: "" });
  const [ecDraft, setEcDraft] = useState<EcDraft[]>([]);
  const [engDrafts, setEngDrafts] = useState<Record<number, EngDraft>>({});
  const [retiring, setRetiring] = useState<EngagementDetail | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [endReason, setEndReason] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");

  const q = useQuery({ queryKey: ["person", id], queryFn: () => api.get<PersonDetail>(`/people/${id}`) });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles"), enabled: canManage });

  // Keep the form in sync with server data while not editing (view == the form, read-only).
  const p = q.data;
  useEffect(() => {
    if (!p || editing) return;
    setDraft({
      given_name: p.given_name, middle_names: p.middle_names ?? "", family_name: p.family_name,
      preferred_name: p.preferred_name ?? "", dob: p.date_of_birth ? dayjs(p.date_of_birth).toDate() : null,
      mobile: p.mobile ?? "", email: p.email ?? "", is_active: p.is_active,
      role_ids: p.roles.map((r) => String(r.id)),
    });
    setAddr({
      line1: p.address?.line1 ?? "", line2: p.address?.line2 ?? "", suburb: p.address?.suburb ?? "",
      state: p.address?.state ?? "", postcode: p.address?.postcode ?? "",
    });
    setEcDraft(p.emergency_contacts.map((e) => ({
      name: e.name, relationship: e.relationship ?? "", phone: e.phone ?? "",
    })));
    setEngDrafts(Object.fromEntries(p.engagements.map((e) => [e.id, engToDraft(e)])));
  }, [p, editing]);

  const saveM = useMutation({
    mutationFn: async () => {
      await api.patch(`/people/${id}`, {
        given_name: draft.given_name, middle_names: draft.middle_names || null,
        family_name: draft.family_name, preferred_name: draft.preferred_name || null,
        date_of_birth: draft.dob ? dayjs(draft.dob).format("YYYY-MM-DD") : null,
        mobile: draft.mobile || null, email: draft.email || null,
        is_active: draft.is_active, role_ids: draft.role_ids.map(Number),
      });
      await api.put(`/people/${id}/address`, {
        line1: addr.line1 || null, line2: addr.line2 || null, suburb: addr.suburb || null,
        state: addr.state || null, postcode: addr.postcode || null,
      });
      await api.put(
        `/people/${id}/emergency-contacts`,
        ecDraft
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), relationship: c.relationship || null, phone: c.phone || null })),
      );
      for (const e of p?.engagements ?? []) {
        const d = engDrafts[e.id];
        if (!d) continue;
        await api.patch(`/people/${id}/engagements/${e.id}`, {
          employment_basis: d.employment_basis || null,
          position_title: d.position_title || null,
          start_date: d.start_date ? dayjs(d.start_date).format("YYYY-MM-DD") : null,
        });
        if (e.engagement_type === "contractor") {
          await api.put(`/people/${id}/engagements/${e.id}/business`, {
            legal_name: d.legal_name || null, trading_name: d.trading_name || null,
            abn: d.abn || null, gst_registered: d.gst_registered,
          });
        }
        if (e.can_view_sensitive) {
          if (e.engagement_type === "employee") {
            await api.put(`/people/${id}/engagements/${e.id}/tax`, {
              tfn: d.tfn || null, tfn_not_provided: d.tfn_not_provided, residency: d.residency,
              claim_tax_free_threshold: d.claim_tax_free_threshold, has_study_loan: d.has_study_loan,
            });
            await api.put(`/people/${id}/engagements/${e.id}/super`, {
              fund_type: d.fund_type, fund_name: d.fund_name || null, fund_usi: d.fund_usi || null,
              member_number: d.member_number || null, esa: d.esa || null,
              smsf_bank_bsb: d.smsf_bank_bsb || null, smsf_bank_account: d.smsf_bank_account || null,
            });
          }
          if (e.engagement_type === "employee" || e.engagement_type === "contractor") {
            await api.put(`/people/${id}/engagements/${e.id}/bank`, {
              account_name: d.account_name || null, bank_name: d.bank_name || null,
              bsb: d.bsb || null, account_number: d.account_number || null,
            });
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["person", id] }); setEditing(false); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const pinM = useMutation({
    mutationFn: (pin: string | null) => api.put(`/people/${id}/pin`, { pin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      setPinOpen(false);
      setPinValue("");
      notifications.show({ color: "teal", message: "Check-in PIN updated." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const engM = useMutation({
    mutationFn: (v: { engId: number; body: Record<string, unknown> }) =>
      api.patch(`/people/${id}/engagements/${v.engId}`, v.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["person", id] }); setRetiring(null); setEndReason(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading) return <Loader />;
  if (q.isError || !p) return <Text c="red">Could not load this person.</Text>;

  const ro = !editing;
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const setEng = (engId: number, patch: Partial<EngDraft>) =>
    setEngDrafts((prev) => ({ ...prev, [engId]: { ...prev[engId], ...patch } }));

  return (
    <Stack maw={820} w="100%" mx="auto">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Anchor onClick={() => navigate("/people")} c="dimmed">
            <Group gap={4}><IconArrowLeft size={16} /> People</Group>
          </Anchor>
          <Title order={2}>{p.full_name}</Title>
          {!p.is_active && <Badge color="gray" variant="light">Disabled</Badge>}
          {p.is_active && !p.onboarded && <Badge color="yellow" variant="light">Invited</Badge>}
        </Group>
        {canManage && (
          editing ? (
            <Group gap="xs">
              <Button variant="default" onClick={() => setEditing(false)}>Cancel</Button>
              <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
            </Group>
          ) : (
            <Button variant="light" onClick={() => setEditing(true)}>Edit details</Button>
          )
        )}
      </Group>

      {/* Personal */}
      <Card withBorder>
        <Title order={4} mb="sm">Personal</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Given name" value={draft.given_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, given_name: e.currentTarget.value })} />
          <TextInput label="Family name" value={draft.family_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, family_name: e.currentTarget.value })} />
          <TextInput label="Middle name/s" value={draft.middle_names} disabled={ro}
            onChange={(e) => setDraft({ ...draft, middle_names: e.currentTarget.value })} />
          <TextInput label="Display name" value={draft.preferred_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, preferred_name: e.currentTarget.value })} />
          <DateField label="Date of birth" value={draft.dob} disabled={ro} maxDate={new Date()}
            onChange={(d) => setDraft({ ...draft, dob: d })} />
          <TextInput label="Email" value={draft.email} disabled={ro}
            onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })} />
          <PhoneField label="Mobile" value={draft.mobile} disabled={ro}
            onChange={(v) => setDraft({ ...draft, mobile: v })} />
        </SimpleGrid>
        <Divider my="sm" label="Address" labelPosition="left" />
        <Stack gap="sm">
          <TextInput label="Line 1" value={addr.line1} disabled={ro}
            onChange={(e) => setAddr({ ...addr, line1: e.currentTarget.value })} />
          <TextInput label="Line 2" value={addr.line2} disabled={ro}
            onChange={(e) => setAddr({ ...addr, line2: e.currentTarget.value })} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Suburb" value={addr.suburb} disabled={ro}
              onChange={(e) => setAddr({ ...addr, suburb: e.currentTarget.value })} />
            <TextInput label="State" value={addr.state} disabled={ro}
              onChange={(e) => setAddr({ ...addr, state: e.currentTarget.value })} />
            <TextInput label="Postcode" value={addr.postcode} disabled={ro}
              onChange={(e) => setAddr({ ...addr, postcode: e.currentTarget.value })} />
          </SimpleGrid>
        </Stack>
        <Divider my="sm" />
        <MultiSelect label="Roles" data={roleOptions} value={draft.role_ids} disabled={ro} searchable
          onChange={(v) => setDraft({ ...draft, role_ids: v })} />
        <Switch mt="sm" label="Active" checked={draft.is_active} disabled={ro}
          onChange={(e) => setDraft({ ...draft, is_active: e.currentTarget.checked })} />
        {canManage && (
          <Group mt="sm" gap="sm">
            <Text size="sm" c="dimmed">Check-in PIN:</Text>
            <Text size="sm" fw={500}>{p.has_pin ? "Set" : "Not set"}</Text>
            <Button size="xs" variant="light" onClick={() => { setPinValue(""); setPinOpen(true); }}>
              {p.has_pin ? "Reset PIN" : "Set PIN"}
            </Button>
          </Group>
        )}
      </Card>

      {/* Engagements */}
      <Card withBorder>
        <Title order={4} mb="sm">Engagements</Title>
        <Stack>
          {p.engagements.length === 0 && <Text size="sm" c="dimmed">None.</Text>}
          {p.engagements.map((e) => {
            const d = engDrafts[e.id];
            if (!d) return null;
            const isEmp = e.engagement_type === "employee";
            const isCon = e.engagement_type === "contractor";
            return (
              <Card key={e.id} withBorder radius="sm" bg="var(--mantine-color-default)">
                <Group justify="space-between" wrap="wrap" mb="xs">
                  <Group gap="xs">
                    <Badge>{TYPE_LABEL[e.engagement_type] ?? e.engagement_type}</Badge>
                    {e.is_active ? (
                      <Badge color="teal" variant="light">Active</Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Retired{e.end_date ? ` ${dayjs(e.end_date).format("DD/MM/YYYY")}` : ""}
                        {e.end_reason ? ` · ${e.end_reason}` : ""}
                      </Badge>
                    )}
                  </Group>
                  {canManage && !editing && (
                    e.is_active ? (
                      <Button size="xs" variant="light" color="orange"
                        onClick={() => { setEndDate(new Date()); setEndReason(""); setRetiring(e); }}>
                        Retire
                      </Button>
                    ) : (
                      <Button size="xs" variant="subtle" loading={engM.isPending}
                        onClick={() => engM.mutate({ engId: e.id, body: { is_active: true, end_date: null, end_reason: null } })}>
                        Reactivate
                      </Button>
                    )
                  )}
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  {isEmp && (
                    <Select label="Basis" data={BASIS_OPTIONS} value={d.employment_basis} disabled={ro}
                      onChange={(v) => setEng(e.id, { employment_basis: v })} />
                  )}
                  <TextInput label="Position" value={d.position_title} disabled={ro}
                    onChange={(ev) => setEng(e.id, { position_title: ev.currentTarget.value })} />
                  <DateField label="Start date" value={d.start_date} disabled={ro}
                    onChange={(dt) => setEng(e.id, { start_date: dt })} />
                </SimpleGrid>
                {editing && (
                  <Text size="xs" c="dimmed" mt={6}>
                    To change the type, retire this engagement and create a new one (re-onboard).
                  </Text>
                )}

                {isCon && (
                  <>
                    <Divider my="sm" label="Business" labelPosition="left" />
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <TextInput label="Legal name" value={d.legal_name} disabled={ro}
                        onChange={(ev) => setEng(e.id, { legal_name: ev.currentTarget.value })} />
                      <TextInput label="Trading name" value={d.trading_name} disabled={ro}
                        onChange={(ev) => setEng(e.id, { trading_name: ev.currentTarget.value })} />
                      <TextInput label="ABN" value={d.abn} disabled={ro}
                        onChange={(ev) => setEng(e.id, { abn: ev.currentTarget.value })} />
                      <Checkbox mt="lg" label="GST registered" checked={d.gst_registered} disabled={ro}
                        onChange={(ev) => setEng(e.id, { gst_registered: ev.currentTarget.checked })} />
                    </SimpleGrid>
                  </>
                )}

                {!e.can_view_sensitive && (e.has_tax || e.has_super || e.has_bank) && (
                  <>
                    <Divider my="sm" label="Payroll" labelPosition="left" />
                    <Text size="sm" c="dimmed">
                      Tax, super and bank details are on file. Payroll access (view sensitive
                      data) is required to see or edit them.
                    </Text>
                  </>
                )}

                {e.can_view_sensitive && isEmp && (
                  <>
                    <Divider my="sm" label="Tax" labelPosition="left" />
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <Select label="Residency" data={RESIDENCY_OPTIONS} value={d.residency} disabled={ro}
                        onChange={(v) => setEng(e.id, { residency: v || "resident" })} />
                      <TextInput label="Tax File Number" value={d.tfn} disabled={ro || d.tfn_not_provided}
                        onChange={(ev) => setEng(e.id, { tfn: ev.currentTarget.value })} />
                      <Checkbox label="TFN not provided" checked={d.tfn_not_provided} disabled={ro}
                        onChange={(ev) => setEng(e.id, { tfn_not_provided: ev.currentTarget.checked })} />
                      <Checkbox label="Claims tax-free threshold" checked={d.claim_tax_free_threshold} disabled={ro}
                        onChange={(ev) => setEng(e.id, { claim_tax_free_threshold: ev.currentTarget.checked })} />
                      <Checkbox label="Has study/training loan" checked={d.has_study_loan} disabled={ro}
                        onChange={(ev) => setEng(e.id, { has_study_loan: ev.currentTarget.checked })} />
                    </SimpleGrid>

                    <Divider my="sm" label="Super" labelPosition="left" />
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <Select label="Fund type" data={FUND_OPTIONS} value={d.fund_type} disabled={ro}
                        onChange={(v) => setEng(e.id, { fund_type: v || "apra" })} />
                      <TextInput label="Fund name" value={d.fund_name} disabled={ro}
                        onChange={(ev) => setEng(e.id, { fund_name: ev.currentTarget.value })} />
                      {d.fund_type === "smsf" ? (
                        <>
                          <TextInput label="ESA" value={d.esa} disabled={ro}
                            onChange={(ev) => setEng(e.id, { esa: ev.currentTarget.value })} />
                          <TextInput label="SMSF BSB" placeholder="XXX-XXX" value={d.smsf_bank_bsb} disabled={ro}
                            onChange={(ev) => setEng(e.id, { smsf_bank_bsb: formatBsb(ev.currentTarget.value) })} />
                          <TextInput label="SMSF account" value={d.smsf_bank_account} disabled={ro}
                            onChange={(ev) => setEng(e.id, { smsf_bank_account: ev.currentTarget.value })} />
                        </>
                      ) : (
                        <TextInput label="USI" value={d.fund_usi} disabled={ro}
                          onChange={(ev) => setEng(e.id, { fund_usi: ev.currentTarget.value })} />
                      )}
                      <TextInput label="Member number" value={d.member_number} disabled={ro}
                        onChange={(ev) => setEng(e.id, { member_number: ev.currentTarget.value })} />
                    </SimpleGrid>
                  </>
                )}

                {e.can_view_sensitive && (isEmp || isCon) && (
                  <>
                    <Divider my="sm" label="Bank" labelPosition="left" />
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <TextInput label="Account name" value={d.account_name} disabled={ro}
                        onChange={(ev) => setEng(e.id, { account_name: ev.currentTarget.value })} />
                      <TextInput label="Bank" value={d.bank_name} disabled={ro}
                        onChange={(ev) => setEng(e.id, { bank_name: ev.currentTarget.value })} />
                      <TextInput label="BSB" placeholder="XXX-XXX" value={d.bsb} disabled={ro}
                        onChange={(ev) => setEng(e.id, { bsb: formatBsb(ev.currentTarget.value) })} />
                      <TextInput label="Account number" value={d.account_number} disabled={ro}
                        onChange={(ev) => setEng(e.id, { account_number: ev.currentTarget.value })} />
                    </SimpleGrid>
                  </>
                )}
              </Card>
            );
          })}
        </Stack>
      </Card>

      {can("manage_settings") && <PersonRatesSection personId={p.id} />}

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4}>Emergency contacts</Title>
          {editing && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
              onClick={() => setEcDraft([...ecDraft, { name: "", relationship: "", phone: "" }])}>
              Add contact
            </Button>
          )}
        </Group>
        {ecDraft.length === 0 ? (
          <Text size="sm" fs="italic" c="dimmed">None recorded</Text>
        ) : (
          <Stack>
            {ecDraft.map((c, i) => {
              const upd = (patch: Partial<EcDraft>) =>
                setEcDraft(ecDraft.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
              return (
                <Group key={i} align="flex-end" wrap="nowrap" gap="xs">
                  <TextInput label={i === 0 ? "Name" : undefined} style={{ flex: 1 }} value={c.name} disabled={ro}
                    onChange={(e) => upd({ name: e.currentTarget.value })} />
                  <Select label={i === 0 ? "Relationship" : undefined} data={relOptions(c.relationship)} style={{ flex: 1 }}
                    value={c.relationship || null} disabled={ro} onChange={(v) => upd({ relationship: v || "" })}
                    placeholder="Select" comboboxProps={{ withinPortal: true }} />
                  <PhoneField label={i === 0 ? "Phone" : undefined} value={c.phone} disabled={ro}
                    onChange={(v) => upd({ phone: v })} />
                  {editing && (
                    <ActionIcon color="red" variant="subtle" aria-label="Remove"
                      onClick={() => setEcDraft(ecDraft.filter((_, idx) => idx !== i))}>
                      <IconX size={16} />
                    </ActionIcon>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}
      </Card>

      {p.credentials.length > 0 && (
        <Card withBorder>
          <Title order={4} mb="sm">Credentials</Title>
          <Stack gap={4}>
            {p.credentials.map((cr) => (
              <Text key={cr.id} size="sm">
                {CRED_LABEL[cr.credential_type] ?? cr.credential_type}
                {cr.identifier ? ` — ${cr.identifier}` : ""}
                {cr.expires_on ? ` (expires ${dayjs(cr.expires_on).format("DD/MM/YYYY")})` : ""}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

      <Modal opened={pinOpen} onClose={() => setPinOpen(false)} title="Check-in PIN">
        <Stack>
          <Text size="sm" c="dimmed">
            Set a 6–8 digit PIN this person enters at a check-in terminal.
          </Text>
          <TextInput label="New PIN" value={pinValue} inputMode="numeric" maxLength={8}
            onChange={(e) => setPinValue(e.currentTarget.value.replace(/\D/g, "").slice(0, 8))} />
          <Group justify="space-between">
            {p.has_pin ? (
              <Button variant="light" color="red" loading={pinM.isPending}
                onClick={() => pinM.mutate(null)}>
                Clear PIN
              </Button>
            ) : (
              <span />
            )}
            <Button loading={pinM.isPending} disabled={pinValue.length < 6}
              onClick={() => pinM.mutate(pinValue)}>
              Set PIN
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={retiring !== null} onClose={() => setRetiring(null)} title="Retire engagement" closeOnClickOutside={false}>
        <Stack>
          <Text size="sm" c="dimmed">The engagement is kept for records, marked retired from the end date.</Text>
          <DateField label="End date" value={endDate} onChange={setEndDate} />
          <Textarea label="Reason (optional)" value={endReason} autosize minRows={2}
            onChange={(e) => setEndReason(e.currentTarget.value)} />
          <Button color="orange" loading={engM.isPending}
            onClick={() => retiring && engM.mutate({
              engId: retiring.id,
              body: { is_active: false, end_date: endDate ? dayjs(endDate).format("YYYY-MM-DD") : null, end_reason: endReason || null },
            })}>
            Retire
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
