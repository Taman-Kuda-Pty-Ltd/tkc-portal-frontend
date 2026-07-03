import {
  Anchor,
  Badge,
  Button,
  Card,
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
import { IconArrowLeft } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { EngagementDetail, PersonDetail, Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { PhoneField } from "../components/PhoneField";
import { useSettings } from "../settings/SettingsContext";

const TYPE_LABEL: Record<string, string> = {
  employee: "Employee",
  contractor: "Contractor",
  volunteer: "Volunteer",
  other: "Other",
};
const BASIS_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
};
const RESIDENCY_LABEL: Record<string, string> = {
  resident: "Australian resident",
  non_resident: "Non-resident",
  working_holiday_maker: "Working holiday maker",
};
const CRED_LABEL: Record<string, string> = {
  wwcc: "Working With Children Check",
  first_aid: "First Aid",
  coaching: "Coaching accreditation",
  police_check: "Police check",
  drivers_licence: "Driver's licence",
  other: "Other",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <Text size="xs" c="dimmed">{label}</Text>
      {empty ? (
        <Text size="sm" fs="italic" c="dimmed">Not provided</Text>
      ) : (
        <Text size="sm">{value}</Text>
      )}
    </div>
  );
}

interface EngDraft {
  employment_basis: string;
  position_title: string;
  start_date: Date | null;
}

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { dateFormat } = useSettings();
  const canManage = can("manage_people");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    given_name: "", middle_names: "", family_name: "", preferred_name: "",
    dob: null as Date | null, mobile: "", email: "", is_active: true, role_ids: [] as string[],
  });
  const [addr, setAddr] = useState({ line1: "", line2: "", suburb: "", state: "", postcode: "" });
  const [engDrafts, setEngDrafts] = useState<Record<number, EngDraft>>({});
  const [retiring, setRetiring] = useState<EngagementDetail | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [endReason, setEndReason] = useState("");

  const q = useQuery({ queryKey: ["person", id], queryFn: () => api.get<PersonDetail>(`/people/${id}`) });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles"), enabled: canManage });

  const fmt = (s: string | null) => (s ? dayjs(s).format(dateFormat) : null);

  function startEdit(p: PersonDetail) {
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
    setEngDrafts(
      Object.fromEntries(p.engagements.map((e) => [e.id, {
        employment_basis: e.employment_basis ?? "", position_title: e.position_title ?? "",
        start_date: e.start_date ? dayjs(e.start_date).toDate() : null,
      }])),
    );
    setEditing(true);
  }

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
      for (const [engId, d] of Object.entries(engDrafts)) {
        await api.patch(`/people/${id}/engagements/${engId}`, {
          employment_basis: d.employment_basis || null,
          position_title: d.position_title || null,
          start_date: d.start_date ? dayjs(d.start_date).format("YYYY-MM-DD") : null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      setEditing(false);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const engM = useMutation({
    mutationFn: (v: { engId: number; body: Record<string, unknown> }) =>
      api.patch(`/people/${id}/engagements/${v.engId}`, v.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      setRetiring(null);
      setEndReason("");
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading) return <Loader />;
  if (q.isError || !q.data) return <Text c="red">Could not load this person.</Text>;
  const p = q.data;

  const addressLine =
    p.address &&
    [p.address.line1, p.address.line2, p.address.suburb, p.address.state, p.address.postcode, p.address.country]
      .filter(Boolean).join(", ");
  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));

  return (
    <Stack maw={900} w="100%" mx="auto">
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
            <Button variant="light" onClick={() => startEdit(p)}>Edit details</Button>
          )
        )}
      </Group>

      {/* Personal */}
      <Card withBorder>
        <Title order={4} mb="sm">Personal</Title>
        {editing ? (
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Given name" value={draft.given_name} onChange={(e) => setDraft({ ...draft, given_name: e.currentTarget.value })} />
              <TextInput label="Family name" value={draft.family_name} onChange={(e) => setDraft({ ...draft, family_name: e.currentTarget.value })} />
              <TextInput label="Middle name/s" value={draft.middle_names} onChange={(e) => setDraft({ ...draft, middle_names: e.currentTarget.value })} />
              <TextInput label="Display name" value={draft.preferred_name} onChange={(e) => setDraft({ ...draft, preferred_name: e.currentTarget.value })} />
              <DateField label="Date of birth" value={draft.dob} onChange={(d) => setDraft({ ...draft, dob: d })} maxDate={new Date()} />
              <TextInput label="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })} />
              <PhoneField label="Mobile" value={draft.mobile} onChange={(v) => setDraft({ ...draft, mobile: v })} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Address line 1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.currentTarget.value })} />
              <TextInput label="Address line 2" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.currentTarget.value })} />
              <TextInput label="Suburb" value={addr.suburb} onChange={(e) => setAddr({ ...addr, suburb: e.currentTarget.value })} />
              <TextInput label="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.currentTarget.value })} />
              <TextInput label="Postcode" value={addr.postcode} onChange={(e) => setAddr({ ...addr, postcode: e.currentTarget.value })} />
            </SimpleGrid>
            <MultiSelect label="Roles" data={roleOptions} value={draft.role_ids} searchable
              onChange={(v) => setDraft({ ...draft, role_ids: v })} />
            <Switch label="Active" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.currentTarget.checked })} />
          </Stack>
        ) : (
          <>
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              <Field label="Given name" value={p.given_name} />
              <Field label="Middle name/s" value={p.middle_names} />
              <Field label="Family name" value={p.family_name} />
              <Field label="Display name" value={p.preferred_name} />
              <Field label="Date of birth" value={fmt(p.date_of_birth)} />
              <Field label="Email" value={p.email} />
              <Field label="Mobile" value={p.mobile} />
            </SimpleGrid>
            <div style={{ marginTop: "var(--mantine-spacing-sm)" }}>
              <Field label="Address" value={addressLine || null} />
            </div>
            {p.roles.length > 0 && (
              <Group gap={6} mt="sm">
                <Text size="xs" c="dimmed">Roles:</Text>
                {p.roles.map((r) => <Badge key={r.id} variant="light" size="sm">{r.name}</Badge>)}
              </Group>
            )}
          </>
        )}
      </Card>

      {p.emergency_contacts.length > 0 && !editing && (
        <Card withBorder>
          <Title order={4} mb="sm">Emergency contacts</Title>
          <Stack gap={4}>
            {p.emergency_contacts.map((e) => (
              <Text key={e.id} size="sm">
                {e.name}{e.relationship ? ` (${e.relationship})` : ""} — {e.phone ?? "—"}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

      {/* Engagements */}
      <Card withBorder>
        <Title order={4} mb="sm">Engagements</Title>
        <Stack>
          {p.engagements.length === 0 && <Text size="sm" c="dimmed">None.</Text>}
          {p.engagements.map((e) => {
            const d = engDrafts[e.id];
            return (
              <Card key={e.id} withBorder radius="sm" bg="var(--mantine-color-default)">
                <Group justify="space-between" wrap="wrap" mb="xs">
                  <Group gap="xs">
                    <Badge>{TYPE_LABEL[e.engagement_type] ?? e.engagement_type}</Badge>
                    {e.is_active ? (
                      <Badge color="teal" variant="light">Active</Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Retired{e.end_date ? ` ${fmt(e.end_date)}` : ""}
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

                {editing && d ? (
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    {e.engagement_type === "employee" && (
                      <Select label="Basis" data={[
                        { value: "full_time", label: "Full-time" },
                        { value: "part_time", label: "Part-time" },
                        { value: "casual", label: "Casual" },
                      ]} value={d.employment_basis || null}
                        onChange={(v) => setEngDrafts({ ...engDrafts, [e.id]: { ...d, employment_basis: v || "" } })} />
                    )}
                    <TextInput label="Position" value={d.position_title}
                      onChange={(ev) => setEngDrafts({ ...engDrafts, [e.id]: { ...d, position_title: ev.currentTarget.value } })} />
                    <DateField label="Start" value={d.start_date}
                      onChange={(dt) => setEngDrafts({ ...engDrafts, [e.id]: { ...d, start_date: dt } })} />
                  </SimpleGrid>
                ) : (
                  <SimpleGrid cols={{ base: 2, sm: 3 }}>
                    {e.employment_basis && <Field label="Basis" value={BASIS_LABEL[e.employment_basis]} />}
                    <Field label="Position" value={e.position_title} />
                    <Field label="Start" value={fmt(e.start_date)} />
                    {e.end_date && <Field label="End" value={fmt(e.end_date)} />}
                    {e.end_reason && <Field label="Reason" value={e.end_reason} />}
                  </SimpleGrid>
                )}

                {editing && (
                  <Text size="xs" c="dimmed" mt={6}>
                    To change the type, retire this engagement and create a new one (re-onboard).
                  </Text>
                )}

                {!editing && e.business && (
                  <>
                    <Divider my="sm" label="Business" labelPosition="left" />
                    <SimpleGrid cols={{ base: 2, sm: 3 }}>
                      <Field label="Legal name" value={e.business.legal_name} />
                      <Field label="Trading name" value={e.business.trading_name} />
                      <Field label="ABN" value={e.business.abn} />
                      <Field label="GST registered" value={e.business.gst_registered ? "Yes" : "No"} />
                    </SimpleGrid>
                  </>
                )}

                {!editing && (e.has_tax || e.has_super || e.has_bank) && (
                  <>
                    <Divider my="sm" label="Payroll" labelPosition="left" />
                    {!e.can_view_sensitive ? (
                      <Text size="sm" c="dimmed">
                        Tax, super and bank details are on file. Payroll access (view
                        sensitive data) is required to see them.
                      </Text>
                    ) : (
                      <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        {e.tax && (
                          <div>
                            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Tax</Text>
                            <Field label="TFN" value={e.tax.tfn ?? (e.tax.tfn_not_provided ? "Not provided" : null)} />
                            <Field label="Residency" value={RESIDENCY_LABEL[e.tax.residency]} />
                            <Field label="Tax-free threshold" value={e.tax.claim_tax_free_threshold ? "Yes" : "No"} />
                            <Field label="Study loan" value={e.tax.has_study_loan ? "Yes" : "No"} />
                          </div>
                        )}
                        {e.superannuation && (
                          <div>
                            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Super</Text>
                            <Field label="Fund" value={e.superannuation.fund_name} />
                            <Field label={e.superannuation.fund_type === "smsf" ? "ESA" : "USI"}
                              value={e.superannuation.fund_type === "smsf" ? e.superannuation.esa : e.superannuation.fund_usi} />
                            <Field label="Member #" value={e.superannuation.member_number} />
                          </div>
                        )}
                        {e.bank && (
                          <div>
                            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Bank</Text>
                            <Field label="Account name" value={e.bank.account_name} />
                            <Field label="BSB" value={e.bank.bsb} />
                            <Field label="Account number" value={e.bank.account_number} />
                          </div>
                        )}
                      </SimpleGrid>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </Stack>
      </Card>

      {p.credentials.length > 0 && !editing && (
        <Card withBorder>
          <Title order={4} mb="sm">Credentials</Title>
          <Stack gap={4}>
            {p.credentials.map((cr) => (
              <Text key={cr.id} size="sm">
                {CRED_LABEL[cr.credential_type] ?? cr.credential_type}
                {cr.identifier ? ` — ${cr.identifier}` : ""}
                {cr.expires_on ? ` (expires ${fmt(cr.expires_on)})` : ""}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

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
