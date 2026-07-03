import {
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { EngagementDetail, PersonDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
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

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { dateFormat } = useSettings();
  const canManage = can("manage_people");
  const [retiring, setRetiring] = useState<EngagementDetail | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  const q = useQuery({
    queryKey: ["person", id],
    queryFn: () => api.get<PersonDetail>(`/people/${id}`),
  });

  const fmt = (s: string | null) => (s ? dayjs(s).format(dateFormat) : null);

  const engM = useMutation({
    mutationFn: (v: { engId: number; body: Record<string, unknown> }) =>
      api.patch(`/people/${id}/engagements/${v.engId}`, v.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      setRetiring(null);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading) return <Loader />;
  if (q.isError || !q.data)
    return <Text c="red">Could not load this person.</Text>;
  const p = q.data;

  const addressLine =
    p.address &&
    [p.address.line1, p.address.line2, p.address.suburb, p.address.state, p.address.postcode, p.address.country]
      .filter(Boolean)
      .join(", ");

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
      </Group>

      {/* Identity */}
      <Card withBorder>
        <Title order={4} mb="sm">Personal</Title>
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
      </Card>

      {p.emergency_contacts.length > 0 && (
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
          {p.engagements.map((e) => (
            <Card key={e.id} withBorder radius="sm" bg="var(--mantine-color-default)">
              <Group justify="space-between" wrap="wrap" mb="xs">
                <Group gap="xs">
                  <Badge>{TYPE_LABEL[e.engagement_type] ?? e.engagement_type}</Badge>
                  {e.is_active ? (
                    <Badge color="teal" variant="light">Active</Badge>
                  ) : (
                    <Badge color="gray" variant="light">Retired{e.end_date ? ` ${fmt(e.end_date)}` : ""}</Badge>
                  )}
                </Group>
                {canManage && (
                  e.is_active ? (
                    <Button size="xs" variant="light" color="orange"
                      onClick={() => { setEndDate(new Date()); setRetiring(e); }}>
                      Retire
                    </Button>
                  ) : (
                    <Button size="xs" variant="subtle"
                      loading={engM.isPending}
                      onClick={() => engM.mutate({ engId: e.id, body: { is_active: true, end_date: null } })}>
                      Reactivate
                    </Button>
                  )
                )}
              </Group>
              <SimpleGrid cols={{ base: 2, sm: 3 }}>
                {e.employment_basis && <Field label="Basis" value={BASIS_LABEL[e.employment_basis]} />}
                <Field label="Position" value={e.position_title} />
                <Field label="Start" value={fmt(e.start_date)} />
                {e.end_date && <Field label="End" value={fmt(e.end_date)} />}
              </SimpleGrid>

              {e.business && (
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

              {(e.has_tax || e.has_super || e.has_bank) && (
                <>
                  <Divider my="sm" label="Payroll" labelPosition="left" />
                  {!e.can_view_sensitive ? (
                    <Text size="sm" c="dimmed">
                      Tax, super and bank details are on file. Payroll access
                      (view sensitive data) is required to see them.
                    </Text>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      {e.tax && (
                        <div>
                          <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Tax</Text>
                          <Field label="TFN" value={e.tax.tfn ?? (e.tax.tfn_not_provided ? "Not provided" : "—")} />
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
          ))}
        </Stack>
      </Card>

      {p.credentials.length > 0 && (
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

      <Modal opened={retiring !== null} onClose={() => setRetiring(null)} title="Retire engagement">
        <Stack>
          <Text size="sm" c="dimmed">
            The engagement is kept for records, marked retired from the end date.
          </Text>
          <DateField label="End date" value={endDate} onChange={setEndDate} />
          <Button
            color="orange"
            loading={engM.isPending}
            onClick={() =>
              retiring &&
              engM.mutate({
                engId: retiring.id,
                body: { is_active: false, end_date: endDate ? dayjs(endDate).format("YYYY-MM-DD") : null },
              })
            }
          >
            Retire
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
