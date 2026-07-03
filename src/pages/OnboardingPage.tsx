import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, setToken } from "../api/client";
import type { CredentialType, OnboardingContext } from "../api/types";

const CREDENTIAL_TYPES = [
  { value: "wwcc", label: "Working With Children Check" },
  { value: "first_aid", label: "First Aid" },
  { value: "coaching", label: "Coaching accreditation" },
  { value: "police_check", label: "Police check" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "other", label: "Other" },
];

const fmt = (d: Date | null) => (d ? dayjs(d).format("YYYY-MM-DD") : null);

interface CredRow {
  credential_type: CredentialType;
  identifier: string;
  expires_on: Date | null;
}

export function OnboardingPage() {
  const { token = "" } = useParams();
  const ctxQ = useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => api.get<OnboardingContext>(`/onboarding/${token}`),
    retry: false,
  });

  // Sections
  const [personal, setPersonal] = useState({
    given_name: "",
    middle_names: "",
    family_name: "",
    preferred_name: "",
    mobile: "",
  });
  const [dob, setDob] = useState<Date | null>(null);
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    suburb: "",
    state: "",
    postcode: "",
  });
  const [emergency, setEmergency] = useState({ name: "", relationship: "", phone: "" });
  const [employment, setEmployment] = useState({
    employment_basis: "" as "" | "full_time" | "part_time" | "casual",
    position_title: "",
  });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [tax, setTax] = useState({
    tfn: "",
    tfn_not_provided: false,
    residency: "resident" as "resident" | "non_resident" | "working_holiday_maker",
    claim_tax_free_threshold: true,
    has_study_loan: false,
    extra_withholding: false,
  });
  const [supera, setSupera] = useState({
    fund_type: "apra" as "apra" | "smsf",
    fund_name: "",
    fund_usi: "",
    fund_abn: "",
    member_number: "",
    esa: "",
    smsf_bank_bsb: "",
    smsf_bank_account: "",
  });
  const [bank, setBank] = useState({ account_name: "", bank_name: "", bsb: "", account_number: "" });
  const [business, setBusiness] = useState({
    legal_name: "",
    trading_name: "",
    abn: "",
    gst_registered: false,
  });
  const [creds, setCreds] = useState<CredRow[]>([]);
  const [guardian, setGuardian] = useState({
    guardian_name: "",
    relationship: "",
    phone: "",
    email: "",
    consent_given: false,
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ctxQ.data)
      setPersonal((p) => ({
        ...p,
        given_name: ctxQ.data.given_name,
        family_name: ctxQ.data.family_name,
        mobile: ctxQ.data.mobile ?? "",
      }));
  }, [ctxQ.data]);

  const staffType = ctxQ.data?.staff_type ?? "employee";
  const isEmployee = staffType === "employee";
  const isContractor = staffType === "contractor";
  const isMinor = !!dob && dayjs().diff(dayjs(dob), "year") < 18;

  const submitM = useMutation({
    mutationFn: () =>
      api.post<{ access_token: string }>(`/onboarding/${token}`, {
        given_name: personal.given_name,
        middle_names: personal.middle_names || null,
        family_name: personal.family_name,
        preferred_name: personal.preferred_name || null,
        date_of_birth: fmt(dob),
        mobile: personal.mobile || null,
        address: address.line1 || address.suburb ? address : null,
        emergency_contacts: emergency.name ? [emergency] : [],
        staff_type: staffType,
        employment_basis: isEmployee && employment.employment_basis ? employment.employment_basis : null,
        position_title: employment.position_title || null,
        start_date: fmt(startDate),
        tax: isEmployee ? tax : null,
        superannuation: isEmployee ? supera : null,
        bank: isEmployee || isContractor ? bank : null,
        business: isContractor ? business : null,
        credentials: creds
          .filter((c) => c.credential_type)
          .map((c) => ({
            credential_type: c.credential_type,
            identifier: c.identifier || null,
            expires_on: fmt(c.expires_on),
          })),
        guardian: isMinor ? guardian : null,
        password,
        pin: pin || null,
      }),
    onSuccess: (res) => {
      setToken(res.access_token);
      window.location.assign("/schedule"); // hard reload so auth re-initialises
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    setError(null);
    if (!personal.given_name || !personal.family_name) return setError("Please enter your name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (pin && !/^\d{4,6}$/.test(pin)) return setError("PIN must be 4–6 digits.");
    submitM.mutate();
  }

  if (ctxQ.isLoading)
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );

  if (ctxQ.isError)
    return (
      <Center h="100vh" p="md">
        <Paper withBorder p="xl" maw={420}>
          <Title order={3}>Invitation unavailable</Title>
          <Text c="dimmed" mt="sm">
            This onboarding link is invalid, has expired, or was already used.
            Please ask your manager for a new invitation.
          </Text>
        </Paper>
      </Center>
    );

  return (
    <Container size="sm" py="xl">
      <Stack>
        <div>
          <Title order={2}>Welcome to Taman Kuda Club</Title>
          <Text c="dimmed">Complete your details to finish setting up your account.</Text>
        </div>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Your details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Given name" value={personal.given_name} required
              onChange={(e) => setPersonal({ ...personal, given_name: e.currentTarget.value })} />
            <TextInput label="Family name" value={personal.family_name} required
              onChange={(e) => setPersonal({ ...personal, family_name: e.currentTarget.value })} />
            <TextInput label="Middle name/s" value={personal.middle_names}
              onChange={(e) => setPersonal({ ...personal, middle_names: e.currentTarget.value })} />
            <TextInput label="Preferred name" value={personal.preferred_name}
              onChange={(e) => setPersonal({ ...personal, preferred_name: e.currentTarget.value })} />
            <DatePickerInput label="Date of birth" value={dob} onChange={setDob} />
            <TextInput label="Mobile" value={personal.mobile}
              onChange={(e) => setPersonal({ ...personal, mobile: e.currentTarget.value })} />
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Address</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Address line 1" value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.currentTarget.value })} />
            <TextInput label="Address line 2" value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.currentTarget.value })} />
            <TextInput label="Suburb" value={address.suburb}
              onChange={(e) => setAddress({ ...address, suburb: e.currentTarget.value })} />
            <TextInput label="State" value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.currentTarget.value })} />
            <TextInput label="Postcode" value={address.postcode}
              onChange={(e) => setAddress({ ...address, postcode: e.currentTarget.value })} />
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Emergency contact</Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Name" value={emergency.name}
              onChange={(e) => setEmergency({ ...emergency, name: e.currentTarget.value })} />
            <TextInput label="Relationship" value={emergency.relationship}
              onChange={(e) => setEmergency({ ...emergency, relationship: e.currentTarget.value })} />
            <TextInput label="Phone" value={emergency.phone}
              onChange={(e) => setEmergency({ ...emergency, phone: e.currentTarget.value })} />
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Engagement</Title>
          <Text size="sm" c="dimmed" mb="xs">You've been invited as: <b>{staffType}</b></Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {isEmployee && (
              <Select label="Employment basis" data={[
                { value: "full_time", label: "Full-time" },
                { value: "part_time", label: "Part-time" },
                { value: "casual", label: "Casual" },
              ]} value={employment.employment_basis || null}
                onChange={(v) => setEmployment({ ...employment, employment_basis: (v as never) || "" })} />
            )}
            <TextInput label="Position / title" value={employment.position_title}
              onChange={(e) => setEmployment({ ...employment, position_title: e.currentTarget.value })} />
            <DatePickerInput label="Start date" value={startDate} onChange={setStartDate} />
          </SimpleGrid>
        </Paper>

        {isEmployee && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Tax</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Tax File Number" value={tax.tfn} disabled={tax.tfn_not_provided}
                onChange={(e) => setTax({ ...tax, tfn: e.currentTarget.value })} />
              <Select label="Residency for tax" data={[
                { value: "resident", label: "Australian resident" },
                { value: "non_resident", label: "Non-resident" },
                { value: "working_holiday_maker", label: "Working holiday maker" },
              ]} value={tax.residency} allowDeselect={false}
                onChange={(v) => setTax({ ...tax, residency: (v as never) ?? "resident" })} />
            </SimpleGrid>
            <Stack gap={6} mt="sm">
              <Checkbox label="I have not provided a TFN" checked={tax.tfn_not_provided}
                onChange={(e) => setTax({ ...tax, tfn_not_provided: e.currentTarget.checked })} />
              <Checkbox label="Claim the tax-free threshold" checked={tax.claim_tax_free_threshold}
                onChange={(e) => setTax({ ...tax, claim_tax_free_threshold: e.currentTarget.checked })} />
              <Checkbox label="I have a study/training support loan (HELP/HECS/STSL)" checked={tax.has_study_loan}
                onChange={(e) => setTax({ ...tax, has_study_loan: e.currentTarget.checked })} />
              <Checkbox label="Withhold extra tax" checked={tax.extra_withholding}
                onChange={(e) => setTax({ ...tax, extra_withholding: e.currentTarget.checked })} />
            </Stack>
          </Paper>
        )}

        {isEmployee && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Superannuation</Title>
            <Select label="Fund type" data={[
              { value: "apra", label: "Standard fund (APRA)" },
              { value: "smsf", label: "Self-managed (SMSF)" },
            ]} value={supera.fund_type} allowDeselect={false} mb="sm"
              onChange={(v) => setSupera({ ...supera, fund_type: (v as never) ?? "apra" })} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Fund name" value={supera.fund_name}
                onChange={(e) => setSupera({ ...supera, fund_name: e.currentTarget.value })} />
              {supera.fund_type === "apra" ? (
                <TextInput label="Fund USI" value={supera.fund_usi}
                  onChange={(e) => setSupera({ ...supera, fund_usi: e.currentTarget.value })} />
              ) : (
                <TextInput label="ESA (electronic service address)" value={supera.esa}
                  onChange={(e) => setSupera({ ...supera, esa: e.currentTarget.value })} />
              )}
              <TextInput label="Fund ABN" value={supera.fund_abn}
                onChange={(e) => setSupera({ ...supera, fund_abn: e.currentTarget.value })} />
              <TextInput label="Member number" value={supera.member_number}
                onChange={(e) => setSupera({ ...supera, member_number: e.currentTarget.value })} />
              {supera.fund_type === "smsf" && (
                <>
                  <TextInput label="SMSF bank BSB" value={supera.smsf_bank_bsb}
                    onChange={(e) => setSupera({ ...supera, smsf_bank_bsb: e.currentTarget.value })} />
                  <TextInput label="SMSF bank account" value={supera.smsf_bank_account}
                    onChange={(e) => setSupera({ ...supera, smsf_bank_account: e.currentTarget.value })} />
                </>
              )}
            </SimpleGrid>
          </Paper>
        )}

        {(isEmployee || isContractor) && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Bank account</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Account name" value={bank.account_name}
                onChange={(e) => setBank({ ...bank, account_name: e.currentTarget.value })} />
              <TextInput label="Bank name" value={bank.bank_name}
                onChange={(e) => setBank({ ...bank, bank_name: e.currentTarget.value })} />
              <TextInput label="BSB" value={bank.bsb}
                onChange={(e) => setBank({ ...bank, bsb: e.currentTarget.value })} />
              <TextInput label="Account number" value={bank.account_number}
                onChange={(e) => setBank({ ...bank, account_number: e.currentTarget.value })} />
            </SimpleGrid>
          </Paper>
        )}

        {isContractor && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Business details</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Legal name" value={business.legal_name}
                onChange={(e) => setBusiness({ ...business, legal_name: e.currentTarget.value })} />
              <TextInput label="Trading name" value={business.trading_name}
                onChange={(e) => setBusiness({ ...business, trading_name: e.currentTarget.value })} />
              <TextInput label="ABN" value={business.abn}
                onChange={(e) => setBusiness({ ...business, abn: e.currentTarget.value })} />
            </SimpleGrid>
            <Checkbox label="Registered for GST" checked={business.gst_registered} mt="sm"
              onChange={(e) => setBusiness({ ...business, gst_registered: e.currentTarget.checked })} />
          </Paper>
        )}

        <Paper withBorder p="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Credentials</Title>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
              onClick={() => setCreds([...creds, { credential_type: "wwcc", identifier: "", expires_on: null }])}>
              Add
            </Button>
          </Group>
          <Stack gap="xs">
            {creds.length === 0 && <Text size="sm" c="dimmed">None added.</Text>}
            {creds.map((c, i) => (
              <Group key={i} align="flex-end" gap="sm" wrap="wrap">
                <Select w={200} label="Type" data={CREDENTIAL_TYPES} value={c.credential_type} allowDeselect={false}
                  onChange={(v) => setCreds(creds.map((x, ix) => ix === i ? { ...x, credential_type: (v as CredentialType) ?? "other" } : x))} />
                <TextInput label="Number" value={c.identifier}
                  onChange={(e) => setCreds(creds.map((x, ix) => ix === i ? { ...x, identifier: e.currentTarget.value } : x))} />
                <DatePickerInput label="Expires" value={c.expires_on}
                  onChange={(d) => setCreds(creds.map((x, ix) => ix === i ? { ...x, expires_on: d } : x))} />
                <ActionIcon color="red" variant="subtle" mb={6}
                  onClick={() => setCreds(creds.filter((_, ix) => ix !== i))}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </Paper>

        {isMinor && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Guardian consent</Title>
            <Text size="sm" c="dimmed" mb="sm">As you're under 18, we need a parent/guardian's consent.</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Guardian name" value={guardian.guardian_name}
                onChange={(e) => setGuardian({ ...guardian, guardian_name: e.currentTarget.value })} />
              <TextInput label="Relationship" value={guardian.relationship}
                onChange={(e) => setGuardian({ ...guardian, relationship: e.currentTarget.value })} />
              <TextInput label="Phone" value={guardian.phone}
                onChange={(e) => setGuardian({ ...guardian, phone: e.currentTarget.value })} />
              <TextInput label="Email" value={guardian.email}
                onChange={(e) => setGuardian({ ...guardian, email: e.currentTarget.value })} />
            </SimpleGrid>
            <Checkbox mt="sm" label="My parent/guardian consents to my participation" checked={guardian.consent_given}
              onChange={(e) => setGuardian({ ...guardian, consent_given: e.currentTarget.checked })} />
          </Paper>
        )}

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Set your password</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PasswordInput label="Password" value={password} required
              onChange={(e) => setPassword(e.currentTarget.value)} />
            <PasswordInput label="Confirm password" value={confirm} required
              onChange={(e) => setConfirm(e.currentTarget.value)} />
            <TextInput label="PIN (optional, 4–6 digits)" value={pin}
              description="For quick check-in on shared terminals (coming soon)"
              onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))} />
          </SimpleGrid>
        </Paper>

        {error && <Text c="red" size="sm">{error}</Text>}
        <Divider />
        <Group justify="flex-end">
          <Button size="md" loading={submitM.isPending} onClick={submit}>
            Finish onboarding
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
