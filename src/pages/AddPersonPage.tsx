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

interface EngagementDraft {
  engagement_type: EngagementType;
  work_role_id: string | null;
  employment_basis: EmploymentBasis | "";
  position_title: string;
  start_date: Date | null;
}
const emptyEngagement = (): EngagementDraft => ({
  engagement_type: "employee",
  work_role_id: null,
  employment_basis: "casual",
  position_title: "",
  start_date: null,
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

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const roleOptions = (rolesQ.data ?? [])
    .filter((r) => r.is_selectable !== false)
    .map((r) => ({ value: String(r.id), label: r.name }));

  const emailInvalid = !!email.trim() && !EMAIL_RE.test(email.trim());
  const updateEng = (i: number, patch: Partial<EngagementDraft>) =>
    setEngagements((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const inviteM = useMutation({
    mutationFn: () =>
      api.post<Invitation>("/invitations", {
        given_name: given.trim(),
        family_name: family.trim(),
        email: email.trim() || null,
        mobile: mobile || null,
        kind: "staff",
        engagements: engagements.map((e) => ({
          engagement_type: e.engagement_type,
          work_role_id: e.work_role_id ? Number(e.work_role_id) : null,
          employment_basis: e.engagement_type === "employee" && e.employment_basis ? e.employment_basis : null,
          position_title: e.position_title.trim() || null,
          start_date: e.start_date ? dayjs(e.start_date).format("YYYY-MM-DD") : null,
        })),
        role_ids: roleIds.map(Number),
      }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["invitations"] });
      if (inv.email_sent) {
        notifications.show({ color: "teal", message: `Invitation emailed to ${inv.email}.` });
        navigate("/people");
      } else {
        // No email (or send failed) → show the link to copy/hand over.
        setResult(inv);
      }
    },
    onError: (e: Error) => {
      const msg =
        e instanceof ApiError && e.status === 409
          ? "Someone already uses that email address."
          : e.message;
      notifications.show({ color: "red", message: msg });
    },
  });

  const canSubmit = given.trim() && family.trim() && !emailInvalid;

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
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="sm">
            Register a rider and/or the account holder who's responsible for them.
          </Text>
          <Button variant="light" onClick={() => setClientModal(true)}>Register rider / account holder</Button>
          <StudentRegisterModal opened={clientModal} onClose={() => { setClientModal(false); navigate("/people"); }} />
        </Paper>
      ) : (
        <>
          <Paper withBorder p="md">
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
              {email.trim() ? "Send invite" : "Add & get link"}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
