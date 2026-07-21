import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Flex,
  Group,
  Loader,
  Menu,
  Modal,
  MultiSelect,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconDots, IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { EngagementDetail, PersonDetail, Role } from "../api/types";
import { personStatusBadge } from "../lib/personStatus";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { FileUpload, useStorageStatus } from "../components/FileUpload";
import { PersonContextsSection } from "../components/PersonContextsSection";
import { PersonSecurityCard } from "../components/PersonSecurityCard";
import { GuardianConsentCard } from "../components/GuardianConsentCard";
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

/** One label/value row in the profile at-a-glance panel (PROFILE-CARD). */
function ProfileInfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed">{label}</Text>
      {color ? (
        <Badge variant="light" color={color}>{value}</Badge>
      ) : (
        <Text size="sm" fw={500}>{value}</Text>
      )}
    </Group>
  );
}

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("manage_people");
  const storageReady = useStorageStatus();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    given_name: "", middle_names: "", family_name: "", preferred_name: "",
    dob: null as Date | null, mobile: "", email: "", is_active: true, role_ids: [] as string[],
  });
  const [addr, setAddr] = useState({ line1: "", line2: "", line3: "", suburb: "", state: "", postcode: "" });
  const [ecDraft, setEcDraft] = useState<EcDraft[]>([]);
  const [engDrafts, setEngDrafts] = useState<Record<number, EngDraft>>({});
  const [retiring, setRetiring] = useState<EngagementDetail | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [endReason, setEndReason] = useState("");
  const [addingEng, setAddingEng] = useState(false);
  const [engNew, setEngNew] = useState<{ engagement_type: string; work_role_id: string | null; employment_basis: string; start_date: Date | null }>(
    { engagement_type: "employee", work_role_id: null, employment_basis: "casual", start_date: null });
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  // A4: manage actions moved onto the person page (re-onboard / reset password).
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [reOpen, setReOpen] = useState(false);
  const [reDraft, setReDraft] = useState({
    engagement_type: "employee", employment_basis: "casual", position_title: "",
    start_date: null as Date | null, role_ids: [] as string[],
  });

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
      line1: p.address?.line1 ?? "", line2: p.address?.line2 ?? "", line3: p.address?.line3 ?? "",
      suburb: p.address?.suburb ?? "", state: p.address?.state ?? "", postcode: p.address?.postcode ?? "",
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
        line1: addr.line1 || null, line2: addr.line2 || null, line3: addr.line3 || null,
        suburb: addr.suburb || null, state: addr.state || null, postcode: addr.postcode || null,
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

  const pwM = useMutation({
    mutationFn: () => api.patch(`/people/${id}`, { password: pw }),
    onSuccess: () => {
      setPwOpen(false); setPw(""); setPwConfirm("");
      notifications.show({ color: "teal", message: "Password reset." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const activeM = useMutation({
    mutationFn: (is_active: boolean) => api.patch(`/people/${id}`, { is_active }),
    onSuccess: (_d, is_active) => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      notifications.show({ color: "teal", message: is_active ? "Reactivated." : "Deactivated." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const reonboardM = useMutation({
    mutationFn: () =>
      api.post<{ email_sent?: boolean; email?: string }>(`/invitations/reonboard`, {
        person_id: Number(id),
        engagement_type: reDraft.engagement_type,
        employment_basis: reDraft.engagement_type === "employee" ? reDraft.employment_basis : null,
        position_title: reDraft.position_title || null,
        start_date: reDraft.start_date ? dayjs(reDraft.start_date).format("YYYY-MM-DD") : null,
        role_ids: reDraft.role_ids.map(Number),
      }),
    onSuccess: (inv: { email_sent?: boolean; email?: string }) => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      setReOpen(false);
      notifications.show({
        color: inv.email_sent ? "teal" : "yellow",
        message: inv.email_sent ? `Re-onboarding link emailed to ${inv.email}.` : "Re-onboarding started — email couldn't be sent.",
      });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const engM = useMutation({
    mutationFn: (v: { engId: number; body: Record<string, unknown> }) =>
      api.patch(`/people/${id}/engagements/${v.engId}`, v.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["person", id] }); setRetiring(null); setEndReason(""); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const addEngM = useMutation({
    mutationFn: () =>
      api.post(`/people/${id}/engagements`, {
        engagement_type: engNew.engagement_type,
        work_role_id: engNew.work_role_id ? Number(engNew.work_role_id) : null,
        employment_basis: engNew.engagement_type === "employee" ? engNew.employment_basis : null,
        start_date: engNew.start_date ? dayjs(engNew.start_date).format("YYYY-MM-DD") : null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["person", id] }); setAddingEng(false); },
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
      {/* BREADCRUMB-POS: breadcrumb sits on its own line above the name, not inline. */}
      <Anchor onClick={() => navigate("/people")} c="dimmed" w="fit-content">
        <Group gap={4}><IconArrowLeft size={16} /> People</Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap" mt={-8}>
        <Group gap="xs">
          <Title order={2}>{p.full_name}</Title>
          {/* Shared badge: a login-less client reads "Registered", matching the list. */}
          {personStatusBadge(p)}
        </Group>
        {canManage && (
          editing ? (
            <Group gap="xs">
              <Button variant="default" onClick={() => setEditing(false)}>Cancel</Button>
              <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
            </Group>
          ) : (
            <Group gap="xs">
              <Button variant="light" onClick={() => setEditing(true)}>Edit details</Button>
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="default" size="lg" aria-label="More actions"><IconDots size={18} /></ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => {
                    setReDraft({
                      engagement_type: "employee", employment_basis: "casual", position_title: "",
                      start_date: null, role_ids: p.roles.map((r) => String(r.id)),
                    });
                    setReOpen(true);
                  }}>Re-onboard…</Menu.Item>
                  <Menu.Item onClick={() => { setPw(""); setPwConfirm(""); setPwOpen(true); }}>Reset password…</Menu.Item>
                  <Menu.Item onClick={() => { setPinValue(""); setPinOpen(true); }}>
                    {p.has_pin ? "Reset check-in PIN…" : "Set check-in PIN…"}
                  </Menu.Item>
                  <Menu.Divider />
                  {p.is_active ? (
                    <Menu.Item color="red" onClick={() => activeM.mutate(false)}>Deactivate</Menu.Item>
                  ) : (
                    <Menu.Item color="teal" onClick={() => activeM.mutate(true)}>Reactivate</Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          )
        )}
      </Group>

      {/* Manager-entered (or otherwise password-less) person: offer the set-password link. */}
      {canManage && p.onboarded && p.has_password === false && <SetPasswordPrompt personId={p.id} />}

      {/* PORTAL-SECURITY: mobile verification + per-account 2FA (accounts that can sign in). */}
      {canManage && (p.mobile || p.has_password) && <PersonSecurityCard person={p} />}

      {/* MINOR-STAFF-CONSENT: guardian consent for an under-18 worker. */}
      {canManage && p.is_minor && p.roles.length > 0 && <GuardianConsentCard person={p} />}

      {/* Profile — photo + at-a-glance status (PROFILE-CARD) */}
      <Card withBorder>
        <Flex direction={{ base: "column", sm: "row" }} gap="xl" align="flex-start">
          <FileUpload
            scope="person_photo"
            recordId={p.id}
            attachPath={`/people/${p.id}/photo`}
            urlPath={`/people/${p.id}/photo-url`}
            removePath={`/people/${p.id}/photo`}
            invalidateKey={["person", id]}
            storageReady={storageReady}
            variant="avatar"
            crop="circle"
            canEdit={canManage && editing}
            label="Profile"
            size={96}
          />
          <Stack gap={6} style={{ flex: 1, minWidth: 200 }}>
            <ProfileInfoRow label="Status" value={p.is_active ? "Active" : "Disabled"}
              color={p.is_active ? "teal" : "gray"} />
            <ProfileInfoRow label="Date joined"
              value={p.joined_at ? dayjs(p.joined_at).format("D MMM YYYY") : "—"} />
            <ProfileInfoRow label="Last logged in"
              value={p.last_login_at ? dayjs(p.last_login_at).format("D MMM YYYY, HH:mm") : "Never"} />
            <ProfileInfoRow label="Password" value={p.has_password ? "Set" : "Not set"}
              color={p.has_password ? "teal" : "orange"} />
            {p.roles.length > 0 && (
              <ProfileInfoRow label="Check-in PIN" value={p.has_pin ? "Set" : "Not set"}
                color={p.has_pin ? "teal" : "orange"} />
            )}
          </Stack>
        </Flex>
      </Card>

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
          <TextInput label="Line 3" value={addr.line3} disabled={ro}
            onChange={(e) => setAddr({ ...addr, line3: e.currentTarget.value })} />
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
        <MultiSelect label="Portal access" description="What this person can see and do in the app (separate from their job / engagement)"
          data={roleOptions} value={draft.role_ids} disabled={ro} searchable
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

      {/* Engagements — hidden for client-side people (student/account-holder, no engagements) */}
      {!((p.is_student || p.is_account_holder) && p.engagements.length === 0) && (
      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4}>Engagements</Title>
          {canManage && !editing && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
              onClick={() => { setEngNew({ engagement_type: "employee", work_role_id: null, employment_basis: "casual", start_date: new Date() }); setAddingEng(true); }}>
              Add engagement
            </Button>
          )}
        </Group>
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
                    {e.work_role_name && <Badge variant="light" color="grape">{e.work_role_name}</Badge>}
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
      )}

      {canManage && <PersonContextsSection personId={p.id} personName={p.full_name} />}

      {/* PR-2: pay rates only for payable engagements — never for volunteers/students. */}
      {(() => {
        const hasEmployee = p.engagements.some((e) => e.engagement_type === "employee");
        const hasContractor = p.engagements.some((e) => e.engagement_type === "contractor");
        if (!(hasEmployee || hasContractor)) return null;
        if (!(can("manage_pay_rates") || can("manage_shifts"))) return null;
        return (
          <PersonRatesSection personId={p.id} dob={p.date_of_birth} superPercent={p.super_percent ?? null}
            canContractorRates={can("manage_pay_rates")} readOnly={!editing}
            showEmployee={hasEmployee} showContractor={hasContractor} />
        );
      })()}

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
          <Stack gap="md">
            {p.credentials.map((cr) => (
              <div key={cr.id}>
                <Text size="sm" fw={500}>
                  {CRED_LABEL[cr.credential_type] ?? cr.credential_type}
                  {cr.identifier ? ` — ${cr.identifier}` : ""}
                  {cr.state_of_issue ? ` · ${cr.state_of_issue}` : ""}
                  {cr.expires_on ? ` (expires ${dayjs(cr.expires_on).format("DD/MM/YYYY")})` : ""}
                </Text>
                <div style={{ marginTop: 6 }}>
                  <FileUpload
                    scope="credential"
                    recordId={p.id}
                    attachPath={`/people/${p.id}/credentials/${cr.id}/image`}
                    urlPath={`/people/${p.id}/credentials/${cr.id}/image-url`}
                    invalidateKey={["person", id]}
                    storageReady={storageReady}
                    variant="document"
                    canEdit={canManage}
                    label="Copy on file"
                  />
                </div>
              </div>
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

      <Modal opened={addingEng} onClose={() => setAddingEng(false)} title="Add engagement">
        <Stack>
          <Text size="sm" c="dimmed">
            An engagement is a work role at a basis (e.g. part-time groom). A person can hold several;
            pay grades attach to it.
          </Text>
          <Select label="Type" data={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={engNew.engagement_type} onChange={(v) => v && setEngNew({ ...engNew, engagement_type: v })} />
          <Select label="Work role" placeholder="e.g. Groom, Stablehand, Coach" data={roleOptions}
            value={engNew.work_role_id} onChange={(v) => setEngNew({ ...engNew, work_role_id: v })} searchable />
          {engNew.engagement_type === "employee" && (
            <Select label="Basis" data={BASIS_OPTIONS} value={engNew.employment_basis}
              onChange={(v) => v && setEngNew({ ...engNew, employment_basis: v })} />
          )}
          <DateField label="Start date" value={engNew.start_date} onChange={(d) => setEngNew({ ...engNew, start_date: d })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAddingEng(false)}>Cancel</Button>
            <Button loading={addEngM.isPending} disabled={!engNew.work_role_id} onClick={() => addEngM.mutate()}>Add</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={pwOpen} onClose={() => setPwOpen(false)} title="Reset password">
        <Stack>
          <Text size="sm" c="dimmed">Set a new password for {p.full_name}. They can change it later.</Text>
          <PasswordInput label="New password" value={pw} onChange={(e) => setPw(e.currentTarget.value)} />
          <PasswordInput label="Confirm password" value={pwConfirm}
            error={pwConfirm && pw !== pwConfirm ? "Passwords don't match" : null}
            onChange={(e) => setPwConfirm(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button loading={pwM.isPending} disabled={pw.length < 8 || pw !== pwConfirm} onClick={() => pwM.mutate()}>
              Reset password
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={reOpen} onClose={() => setReOpen(false)} title="Re-onboard" closeOnClickOutside={false}>
        <Stack>
          <Text size="sm" c="dimmed">
            Invite {p.full_name} to complete onboarding for a new engagement — same login, a fresh set-up link.
          </Text>
          <Select label="Type" data={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={reDraft.engagement_type} onChange={(v) => v && setReDraft({ ...reDraft, engagement_type: v })} />
          {reDraft.engagement_type === "employee" && (
            <Select label="Basis" data={BASIS_OPTIONS} value={reDraft.employment_basis}
              onChange={(v) => v && setReDraft({ ...reDraft, employment_basis: v })} />
          )}
          <TextInput label="Position title" placeholder="Optional" value={reDraft.position_title}
            onChange={(e) => setReDraft({ ...reDraft, position_title: e.currentTarget.value })} />
          <DateField label="Start date" value={reDraft.start_date} onChange={(d) => setReDraft({ ...reDraft, start_date: d })} />
          <MultiSelect label="Portal access" data={roleOptions} value={reDraft.role_ids} searchable
            onChange={(v) => setReDraft({ ...reDraft, role_ids: v })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setReOpen(false)}>Cancel</Button>
            <Button loading={reonboardM.isPending} onClick={() => reonboardM.mutate()}>Send re-onboarding link</Button>
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

/** Offer a set-password/confirm-mobile link for a person who has no password yet
 *  (e.g. a manager-entered staff member) — PWVERIFY-1. */
function SetPasswordPrompt({ personId }: { personId: number }) {
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      api.post<{ email_sent: boolean; set_password_url: string }>("/invitations/send-set-password", { person_id: personId }),
    onSuccess: (r) => {
      setLink(r.set_password_url);
      setEmailed(r.email_sent);
      notifications.show({ color: "teal", message: r.email_sent ? "Set-password link emailed." : "Link created — copy it below." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  return (
    <Alert color="orange" title="This person can't sign in yet">
      <Text size="sm" mb="sm">
        They were set up manually and haven't set a password. Send them a link to set a
        password and confirm their mobile.
      </Text>
      {!link ? (
        <Button size="xs" loading={m.isPending} onClick={() => m.mutate()}>Send set-password link</Button>
      ) : (
        <Stack gap="xs">
          {emailed && <Text size="xs" c="teal">Emailed to them.</Text>}
          <Group gap="xs" wrap="nowrap">
            <TextInput readOnly value={link} style={{ flex: 1 }} />
            <Button size="xs" variant="light" onClick={() => navigator.clipboard?.writeText(link)}>Copy</Button>
            <Button size="xs" variant="subtle" loading={m.isPending} onClick={() => m.mutate()}>Regenerate</Button>
          </Group>
        </Stack>
      )}
    </Alert>
  );
}
