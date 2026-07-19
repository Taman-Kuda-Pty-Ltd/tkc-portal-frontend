import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  CopyButton,
  Divider,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { EmploymentBasis, EngagementType, Invitation, Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { PhoneField } from "../components/PhoneField";
import { StudentRegisterModal } from "../components/StudentRegisterModal";

const ENGAGEMENT_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
];
const BASES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGE_LABEL: Record<string, string> = {
  adult: "Adult", junior_16: "Jr ≤16", junior_17: "Jr 17", junior_18: "Jr 18", junior_19: "Jr 19",
};
const AGE_ORDER: Record<string, number> = { adult: 0, junior_16: 1, junior_17: 2, junior_18: 3, junior_19: 4 };
interface PayGrade { id: number; name: string; age_category: string; capacity_role_name: string | null; capacity_role_id: number }

interface EngagementDraft {
  engagement_type: EngagementType;
  work_role_id: string | null;
  employment_basis: EmploymentBasis | "";
  position_title: string;
  start_date: Date | null;
  pay_grade_id: string | null;
}
const emptyEngagement = (): EngagementDraft => ({
  engagement_type: "employee",
  work_role_id: null,
  employment_basis: "casual",
  position_title: "",
  start_date: null,
  pay_grade_id: null,
});

export function AddPersonPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [kind, setKind] = useState<"staff" | "school_client">("staff");
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [engagements, setEngagements] = useState<EngagementDraft[]>([emptyEngagement()]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [result, setResult] = useState<Invitation | null>(null);
  const [clientModal, setClientModal] = useState(false);
  // CLIENT-LANDING: pick one of three explicit client actions before showing a form.
  const [clientChoice, setClientChoice] = useState<"invite" | null>(null);
  // MANUAL-STAFF: invite the staffer to self-onboard, or enter their details yourself.
  const [staffMode, setStaffMode] = useState<"invite" | "manual">("invite");

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const gradesQ = useQuery({ queryKey: ["pay-grades"], queryFn: () => api.get<PayGrade[]>("/pay-grades") });
  const roleOptions = (rolesQ.data ?? [])
    .filter((r) => r.is_selectable !== false)
    .map((r) => ({ value: String(r.id), label: r.name }));
  // Grade options for an engagement's work role, adults-first (matches the person page).
  const gradeOptionsFor = (workRoleId: string | null) =>
    [...(gradesQ.data ?? [])]
      .filter((g) => !workRoleId || String(g.capacity_role_id) === workRoleId)
      .sort((a, b) =>
        (a.capacity_role_name ?? "").localeCompare(b.capacity_role_name ?? "") ||
        (AGE_ORDER[a.age_category] ?? 9) - (AGE_ORDER[b.age_category] ?? 9) ||
        a.name.localeCompare(b.name),
      )
      .map((g) => ({
        value: String(g.id),
        label: `${g.capacity_role_name} · ${g.name} (${AGE_LABEL[g.age_category] ?? g.age_category})`,
      }));

  const emailInvalid = !!email.trim() && !EMAIL_RE.test(email.trim());
  const updateEng = (i: number, patch: Partial<EngagementDraft>) => {
    setEngagements((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    // Choosing a Job pre-ticks the matching Portal access (they usually want the
    // portal for the work they do). They can still untick it.
    if (patch.work_role_id) {
      setRoleIds((prev) => (prev.includes(patch.work_role_id!) ? prev : [...prev, patch.work_role_id!]));
    }
  };

  const onInviteSuccess = (inv: Invitation) => {
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["invitations"] });
    if (inv.email_sent) {
      notifications.show({ color: "teal", message: `Invitation emailed to ${inv.email}.` });
      navigate("/people");
    } else {
      // No email (or send failed) → show the link to copy/hand over.
      setResult(inv);
    }
  };
  const onInviteError = (e: Error) => {
    const msg =
      e instanceof ApiError && e.status === 409
        ? "Someone already uses that email address."
        : e.message;
    notifications.show({ color: "red", message: msg });
  };

  const inviteM = useMutation({
    mutationFn: () =>
      api.post<Invitation>("/invitations", {
        given_name: given.trim(),
        family_name: family.trim(),
        email: email.trim() || null,
        mobile: mobile || null,
        kind: "staff",
        // Manager-entry: suppress the onboarding-link email; a set-password email is
        // sent after the manager finishes the full form (MANUAL-STAFF-EMAIL).
        manual_entry: staffMode === "manual",
        engagements: engagements.map((e) => ({
          engagement_type: e.engagement_type,
          work_role_id: e.work_role_id ? Number(e.work_role_id) : null,
          employment_basis: e.engagement_type === "employee" && e.employment_basis ? e.employment_basis : null,
          position_title: e.position_title.trim() || null,
          start_date: e.start_date ? dayjs(e.start_date).format("YYYY-MM-DD") : null,
          pay_grade_id: e.engagement_type === "employee" && e.pay_grade_id ? Number(e.pay_grade_id) : null,
        })),
        role_ids: roleIds.map(Number),
      }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["invitations"] });
      // Manager-entry: jump straight into the full form to fill on their behalf.
      if (staffMode === "manual") {
        const t = inv.onboarding_url?.split("/onboard/")[1];
        if (t) { navigate(`/staff-onboard/${t}`); return; }
      }
      onInviteSuccess(inv);
    },
    onError: onInviteError,
  });

  // STU-1: a school client can also be onboarded by email/link (server assigns
  // the client role and runs the client onboarding flow) — not only manually.
  const clientInviteM = useMutation({
    mutationFn: () =>
      api.post<Invitation>("/invitations", {
        given_name: given.trim(),
        family_name: family.trim(),
        email: email.trim() || null,
        mobile: mobile || null,
        kind: "school_client",
        engagements: [],
        role_ids: [],
      }),
    onSuccess: onInviteSuccess,
    onError: onInviteError,
  });

  // EMAIL-MANDATORY-STAFF: a staff member must have an email (clients may not).
  const canSubmit =
    given.trim() && family.trim() && !emailInvalid && (kind !== "staff" || !!email.trim());

  // --- Result screen: hand over the onboarding link ---
  if (result) {
    return (
      <Stack maw={640} w="100%" mx="auto">
        <Title order={2}>{result.given_name} {result.family_name} added</Title>
        <Alert color="teal" title="They're set up — now share their link">
          <Text size="sm" mb="sm">
            {result.email
              ? "We couldn't email them, so send them this link to set a password and PIN:"
              : "No email on file, so hand them this link to set a password and PIN:"}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput readOnly value={result.onboarding_url ?? ""} style={{ flex: 1 }} />
            <CopyButton value={result.onboarding_url ?? ""}>
              {({ copied, copy }) => (
                <Button color={copied ? "teal" : undefined} onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
        <Group justify="flex-end">
          <Button onClick={() => navigate("/people")}>Done</Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack maw={720} w="100%" mx="auto">
      <Group gap="xs">
        <Anchor onClick={() => navigate("/people")} c="dimmed">
          <Group gap={4}><IconArrowLeft size={16} /> People</Group>
        </Anchor>
        <Title order={2}>Add a person</Title>
      </Group>

      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
        data={[
          { value: "staff", label: "Staff" },
          { value: "school_client", label: "School client (rider / account holder)" },
        ]}
      />

      {kind === "school_client" ? (
        clientChoice === null ? (
          <>
            <Text size="sm" c="dimmed">What would you like to do?</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <ClientChoiceCard
                title="Invite a new client"
                desc="They complete their own and their riders' details via an emailed or copyable link (self-onboard)."
                cta="Invite by email / link"
                onClick={() => setClientChoice("invite")} />
              <ClientChoiceCard
                title="Create a new client"
                desc="Set up an account holder and all their riders yourself, in one flow — no link needed."
                cta="New account & riders"
                onClick={() => navigate("/accounts/new")} />
              <ClientChoiceCard
                title="Create a new student"
                desc="Register a rider — optionally for an existing account holder (incl. a staff member)."
                cta="Register a student"
                onClick={() => setClientModal(true)} />
            </SimpleGrid>
            <StudentRegisterModal opened={clientModal} onClose={() => { setClientModal(false); navigate("/people"); }} />
          </>
        ) : (
          <>
            <Anchor size="sm" c="dimmed" onClick={() => setClientChoice(null)}>
              <Group gap={4}><IconArrowLeft size={14} /> Back to options</Group>
            </Anchor>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="sm">
                Invite the account holder to complete their own (and their rider's) details,
                by email or a copyable link.
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Given name" required value={given} onChange={(e) => setGiven(e.currentTarget.value)} />
                <TextInput label="Family name" required value={family} onChange={(e) => setFamily(e.currentTarget.value)} />
                <TextInput
                  label="Email"
                  description="Optional — leave blank to hand over a link yourself"
                  value={email}
                  error={emailInvalid ? "Enter a valid email address" : null}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
                <PhoneField label="Mobile" value={mobile} onChange={setMobile} />
              </SimpleGrid>
              <Group justify="flex-end" mt="md">
                <Button loading={clientInviteM.isPending} disabled={!canSubmit || !can("manage_onboarding")}
                  onClick={() => clientInviteM.mutate()}>
                  {email.trim() ? "Send invite" : "Add & get link"}
                </Button>
              </Group>
            </Paper>
          </>
        )
      ) : (
        <>
          <Paper withBorder p="md">
            <Text size="sm" fw={600} mb={4}>How would you like to set them up?</Text>
            <SegmentedControl fullWidth value={staffMode} onChange={(v) => setStaffMode(v as "invite" | "manual")}
              data={[
                { value: "invite", label: "Invite (they self-onboard)" },
                { value: "manual", label: "Enter their details myself" },
              ]} />
            <Text size="xs" c="dimmed" mt={6}>
              {staffMode === "invite"
                ? "They get a link to complete their own details and set a password."
                : "You fill in their full details (incl. TFN/bank); they get a link afterwards to set a password and confirm their mobile."}
            </Text>
          </Paper>
          <Paper withBorder p="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Given name" required value={given} onChange={(e) => setGiven(e.currentTarget.value)} />
              <TextInput label="Family name" required value={family} onChange={(e) => setFamily(e.currentTarget.value)} />
              <TextInput
                label="Email"
                required
                description="Required for a staff account"
                value={email}
                error={emailInvalid ? "Enter a valid email address" : null}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PhoneField label="Mobile" value={mobile} onChange={setMobile} />
            </SimpleGrid>
          </Paper>

          <div>
            <Group justify="space-between" mb={6}>
              <Title order={4}>Engagements</Title>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                onClick={() => setEngagements([...engagements, emptyEngagement()])}>
                Add engagement
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mb="sm">
              What this person is hired to do — one row per job. A pay grade can be set on their
              profile once they're added.
            </Text>
            <Stack>
              {engagements.map((e, i) => (
                <Paper key={i} withBorder p="md" radius="sm">
                  <Group justify="space-between" mb="sm">
                    <Text fw={600} size="sm">Engagement {i + 1}</Text>
                    <ActionIcon color="red" variant="subtle" aria-label="Remove engagement"
                      disabled={engagements.length === 1}
                      onClick={() => setEngagements(engagements.filter((_, idx) => idx !== i))}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <Select label="Type" data={ENGAGEMENT_TYPES} value={e.engagement_type} allowDeselect={false}
                      onChange={(v) => updateEng(i, { engagement_type: (v as EngagementType) ?? "employee" })}
                      comboboxProps={{ withinPortal: true }} />
                    <Select label="Job" placeholder="Work role" data={roleOptions} value={e.work_role_id}
                      searchable clearable onChange={(v) => updateEng(i, { work_role_id: v })}
                      comboboxProps={{ withinPortal: true }} />
                    {e.engagement_type === "employee" && (
                      <Select label="Basis" data={BASES} value={e.employment_basis || null}
                        onChange={(v) => updateEng(i, { employment_basis: (v as EmploymentBasis) ?? "" })}
                        comboboxProps={{ withinPortal: true }} />
                    )}
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
                    <TextInput label="Position title" placeholder="Optional" value={e.position_title}
                      onChange={(ev) => updateEng(i, { position_title: ev.currentTarget.value })} />
                    <DateField label="Start date" value={e.start_date} onChange={(d) => updateEng(i, { start_date: d })} />
                  </SimpleGrid>
                  {e.engagement_type === "employee" && (
                    <Select mt="sm" label="Pay grade"
                      description="Optional — rates this person from day one; you can also set it later on their profile"
                      placeholder={e.work_role_id ? "Choose a grade" : "Pick a job first"}
                      data={gradeOptionsFor(e.work_role_id)} value={e.pay_grade_id} searchable clearable
                      onChange={(v) => updateEng(i, { pay_grade_id: v })} comboboxProps={{ withinPortal: true }} />
                  )}
                </Paper>
              ))}
            </Stack>
          </div>

          <Paper withBorder p="md">
            <MultiSelect
              label="Portal access"
              description="What this person can see and do in the app (separate from their job)"
              data={roleOptions}
              value={roleIds}
              onChange={setRoleIds}
              searchable
              clearable
              comboboxProps={{ withinPortal: true }}
            />
          </Paper>

          <Divider />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => navigate("/people")}>Cancel</Button>
            <Button loading={inviteM.isPending} disabled={!canSubmit || !can("manage_onboarding")}
              onClick={() => inviteM.mutate()}>
              {staffMode === "manual" ? "Continue to full details" : "Send invite"}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}

/** One of the three explicit "add a client" choices (CLIENT-LANDING). */
function ClientChoiceCard({ title, desc, cta, onClick }: {
  title: string; desc: string; cta: string; onClick: () => void;
}) {
  return (
    <Paper withBorder p="md" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" style={{ flex: 1 }}>{desc}</Text>
      <Button variant="light" fullWidth onClick={onClick}>{cta}</Button>
    </Paper>
  );
}
