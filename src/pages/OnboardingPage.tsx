import tkcLogo from "../assets/tkc-logo-wide.png";
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
import { IconCircleCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { api, ApiError, setToken } from "../api/client";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { RELATIONSHIPS, GUARDIAN_RELATIONSHIPS } from "../constants/relationships";
import { STATE_OF_ISSUE_OPTIONS } from "../constants/states";
import { DateField } from "../components/DateField";
import { PhoneField, isValidPhoneNumber } from "../components/PhoneField";
import { PhoneConfirmModal } from "../components/PhoneConfirmModal";
import { OnboardingCredentialUpload } from "../components/OnboardingCredentialUpload";
import type { CredentialType, OnboardingContext } from "../api/types";
import { ClientOnboarding } from "./ClientOnboarding";

const STAFF_TYPE_LABEL: Record<string, string> = {
  employee: "Employee",
  contractor: "Contractor",
  volunteer: "Volunteer",
  other: "Other",
};

const CREDENTIAL_TYPES = [
  { value: "wwcc", label: "Working With Children Check" },
  { value: "first_aid", label: "First Aid" },
  { value: "coaching", label: "Coaching accreditation" },
  { value: "police_check", label: "Police check" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "other", label: "Other" },
];

const BASIS_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
};


const fmt = (d: Date | null) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
const phoneOk = (v: string) => !v || isValidPhoneNumber(v);
const formatBsb = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
};

interface CredRow {
  credential_type: CredentialType;
  identifier: string;
  state_of_issue: string;
  expires_on: Date | null;
  image_key: string;
}

export function OnboardingPage({ managerMode = false, tokenOverride }: {
  managerMode?: boolean; tokenOverride?: string;
} = {}) {
  const { token: tokenParam = "" } = useParams();
  const token = tokenOverride ?? tokenParam;
  const ctxQ = useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => api.get<OnboardingContext>(`/onboarding/${token}`),
    retry: false,
  });

  const [personal, setPersonal] = useState({
    given_name: "",
    middle_names: "",
    family_name: "",
    mobile: "",
  });
  const [displayName, setDisplayName] = useState("");
  const [displayEdited, setDisplayEdited] = useState(false);
  const [dob, setDob] = useState<Date | null>(null);
  const [address, setAddress] = useState({ line1: "", line2: "", line3: "", suburb: "", state: "", postcode: "", country: "Australia" });
  const [emergency, setEmergency] = useState({ name: "", relationship: "", phone: "" });
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
  const [business, setBusiness] = useState({ legal_name: "", trading_name: "", abn: "", gst_registered: false });
  const [creds, setCreds] = useState<CredRow[]>([]);
  const [guardian, setGuardian] = useState({ guardian_name: "", relationship: "", phone: "", email: "", consent_given: false });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [changingAuth, setChangingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [noMobile, setNoMobile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const d = ctxQ.data;
    if (!d) return;
    setPersonal({
      given_name: d.given_name,
      middle_names: d.middle_names ?? "",
      family_name: d.family_name,
      mobile: d.mobile ?? "",
    });
    if (d.preferred_name) {
      setDisplayName(d.preferred_name);
      setDisplayEdited(true);
    }
    if (d.date_of_birth) setDob(dayjs(d.date_of_birth).toDate());
    if (d.address)
      setAddress({
        line1: d.address.line1 ?? "",
        line2: d.address.line2 ?? "",
        line3: d.address.line3 ?? "",
        suburb: d.address.suburb ?? "",
        state: d.address.state ?? "",
        postcode: d.address.postcode ?? "",
        country: d.address.country ?? "Australia",
      });
    if (d.emergency_contacts.length) {
      const e = d.emergency_contacts[0];
      setEmergency({ name: e.name, relationship: e.relationship ?? "", phone: e.phone ?? "" });
    }
    if (d.credentials.length)
      setCreds(
        d.credentials.map((cr) => ({
          credential_type: cr.credential_type,
          identifier: cr.identifier ?? "",
          state_of_issue: cr.state_of_issue ?? "",
          expires_on: cr.expires_on ? dayjs(cr.expires_on).toDate() : null,
          image_key: cr.image_key ?? "",
        })),
      );
  }, [ctxQ.data]);

  const hasAccount = ctxQ.data?.has_account ?? false;
  const authDisabled = hasAccount && !changingAuth;

  // Default display name = given + first initial of family, until manually edited.
  useEffect(() => {
    if (!displayEdited) {
      const f = personal.family_name.trim();
      setDisplayName(`${personal.given_name} ${f ? f[0].toUpperCase() : ""}`.trim());
    }
  }, [personal.given_name, personal.family_name, displayEdited]);

  const staffType = ctxQ.data?.engagement_type ?? "employee";
  const isEmployee = staffType === "employee";
  const isContractor = staffType === "contractor";
  const isMinor = !!dob && dayjs().diff(dayjs(dob), "year") < 18;
  const requirePhone = ctxQ.data?.require_phone_verification ?? false;

  const navigate = useNavigate();
  const submitM = useMutation({
    mutationFn: () =>
      api.post<{
        access_token?: string;
        person_id?: number;
        set_password_email_sent?: boolean;
      }>(
        managerMode ? `/onboarding/${token}/manager-complete` : `/onboarding/${token}`, {
        given_name: personal.given_name,
        middle_names: personal.middle_names || null,
        family_name: personal.family_name,
        preferred_name: displayName || null,
        date_of_birth: fmt(dob),
        mobile: noMobile ? null : personal.mobile || null,
        no_mobile: noMobile,
        address: address.line1 || address.suburb ? address : null,
        emergency_contacts: emergency.name ? [emergency] : [],
        tax: isEmployee ? tax : null,
        superannuation: isEmployee ? supera : null,
        bank: isEmployee || isContractor ? bank : null,
        business: isContractor ? business : null,
        credentials: creds
          .filter((c) => c.credential_type)
          .map((c) => ({
            credential_type: c.credential_type,
            identifier: c.identifier || null,
            state_of_issue: c.state_of_issue || null,
            expires_on: fmt(c.expires_on),
            image_key: c.image_key || null,
          })),
        guardian: isMinor ? guardian : null,
        // Manager-entry sets no password/PIN — the staffer sets those via a link (PWVERIFY-1).
        password: managerMode ? null : password || null,
        pin: managerMode ? null : pin || null,
      }),
    onSuccess: (res) => {
      if (managerMode) {
        // A set-password email is auto-sent on completion (MANUAL-STAFF-EMAIL); the
        // profile shows the link + a Resend/Copy fallback if the send didn't land.
        notifications.show({
          color: "teal",
          message: res.set_password_email_sent
            ? "Staff member created — a set-password email has been sent to them."
            : "Staff member created. Send them the set-password link from their profile.",
        });
        navigate(`/people/${res.person_id}`);
        return;
      }
      setToken(res.access_token!);
      sessionStorage.setItem("tkc_welcome", displayName || personal.given_name);
      window.location.assign("/schedule"); // hard reload so auth re-initialises
    },
    onError: (e: Error) => {
      // Map 422 field errors (VAL-1/VAL-2) under each field instead of one banner.
      if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) {
        setFieldErrors(e.fields);
        setError("Please fix the highlighted fields below.");
      } else {
        setError(e.message);
      }
    },
  });

  function submit() {
    setError(null);
    setFieldErrors({});
    if (!personal.given_name || !personal.family_name) return setError("Please enter your name.");
    if (!dob) return setError("Date of birth is required.");
    if (!address.line1.trim()) return setError("A postal address (line 1) is required.");
    // AU-ADDR-MANDATORY (T5-06): a complete Australian address needs suburb, state, postcode.
    const isAU = !(address.country || "").trim() || /^(australia|au)$/i.test(address.country.trim());
    if (isAU && (!address.suburb.trim() || !address.state.trim() || !address.postcode.trim()))
      return setError("For an Australian address, suburb, state and postcode are required.");
    if (!emergency.name.trim()) return setError("An emergency contact name is required."); // T5-07
    if (!noMobile && !phoneOk(personal.mobile)) return setError("Enter a valid mobile number, or tick that you don't have one.");
    if (emergency.name && !phoneOk(emergency.phone)) return setError("Enter a valid emergency contact phone.");
    // Guardian consent is mandatory for under-18s (UAT#3 MINOR-1).
    if (isMinor) {
      if (!guardian.guardian_name.trim() || !guardian.relationship || !guardian.email.trim())
        return setError("Guardian name, relationship and email are required for under-18s.");
      if (!phoneOk(guardian.phone)) return setError("Enter a valid guardian phone.");
      if (!guardian.consent_given)
        return setError("A parent/guardian must consent before an under-18 can be set up.");
    }
    if (isEmployee && !tax.tfn.trim() && !tax.tfn_not_provided)
      return setError("Provide a Tax File Number, or tick 'I have not provided a TFN'.");
    if (isEmployee || isContractor) {
      if (!bank.account_name || !bank.bsb || !bank.account_number)
        return setError("Bank account name, BSB and account number are required.");
      if (bank.bsb.replace(/\D/g, "").length !== 6)
        return setError("Enter a valid 6-digit BSB (XXX-XXX).");
    }
    // Manager-entry skips password + mobile-confirm entirely (the staffer does those
    // later via a set-password link) — submit straight away (UAT#3 MANUAL-STAFF).
    if (managerMode) {
      submitM.mutate();
      return;
    }
    if (!hasAccount || password) {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords do not match.");
    }
    if (pin && !/^\d{6,8}$/.test(pin)) return setError("PIN must be 6–8 digits.");
    // 2FA (UAT#3 2FA-1): confirm the mobile with a code in a modal, then submit.
    // Opting out of a mobile (or an already-verified number) skips straight to submit.
    if (requirePhone && !noMobile && !phoneVerified) {
      setConfirmOpen(true);
      return;
    }
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

  if (ctxQ.data?.kind === "school_client")
    return <ClientOnboarding token={token} ctx={ctxQ.data} />;

  return (
    <Container size="sm" py="xl">
      <Stack>
        {/* SELFONBOARD-BRANDING: brand the invitee-facing header with the wordmark. */}
        {!managerMode && (
          <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 64, width: "auto", maxWidth: "100%", alignSelf: "center" }} />
        )}
        <div>
          <Title order={2}>{managerMode ? "Add staff member — full details" : "Welcome to Taman Kuda Club"}</Title>
          <Text c="dimmed">
            {managerMode
              ? "Enter this staff member's details on their behalf. They'll set their own password and confirm their mobile afterwards."
              : "Complete your details to finish setting up your account."}
          </Text>
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
            <TextInput label="Display name" value={displayName}
              onChange={(e) => { setDisplayEdited(true); setDisplayName(e.currentTarget.value); }} />
            <DateField label="Date of birth" required value={dob} onChange={setDob} maxDate={new Date()} />
            {/* Mobile is confirmed by a code at the end (UAT#3 2FA-1), unless the
                person opts out of having a mobile below. */}
            <div>
              <PhoneField label="Mobile" value={personal.mobile} error={fieldErrors["mobile"]} disabled={noMobile}
                onChange={(v) => { setPersonal({ ...personal, mobile: v }); setPhoneVerified(false); }} />
              {!managerMode && requirePhone && phoneVerified && !noMobile && (
                <Group gap={6} c="teal" mt={4}><IconCircleCheck size={16} /><Text size="xs" fw={500}>Mobile confirmed</Text></Group>
              )}
              {!managerMode && requirePhone && !phoneVerified && !noMobile && (
                <Text size="xs" c="dimmed" mt={4}>We'll text a code to confirm this when you finish.</Text>
              )}
              {managerMode && (
                <Text size="xs" c="dimmed" mt={4}>They'll confirm this when they set their password.</Text>
              )}
            </div>
          </SimpleGrid>
          {!managerMode && requirePhone && (
            <Checkbox mt="sm" checked={noMobile}
              onChange={(e) => { setNoMobile(e.currentTarget.checked); setPhoneVerified(false); }}
              label="This person doesn't have a mobile number (skip mobile verification)" />
          )}
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Address</Title>
          <Stack>
            <AddressAutocomplete value={address.line1} token={token} required
              onChange={(line1) => setAddress({ ...address, line1 })}
              onSelect={(p) => setAddress({ ...address, line1: p.line1, line2: p.line2 || address.line2, suburb: p.suburb, state: p.state, postcode: p.postcode })} />
            <TextInput label="Address line 2" value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.currentTarget.value })} />
            <TextInput label="Address line 3" value={address.line3}
              onChange={(e) => setAddress({ ...address, line3: e.currentTarget.value })} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="Suburb" required value={address.suburb}
                onChange={(e) => setAddress({ ...address, suburb: e.currentTarget.value })} />
              <TextInput label="State" required value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.currentTarget.value })} />
              <TextInput label="Postcode" required value={address.postcode}
                onChange={(e) => setAddress({ ...address, postcode: e.currentTarget.value })} />
            </SimpleGrid>
            <TextInput label="Country" value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.currentTarget.value })} />
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Emergency contact</Title>
          <Stack>
            {/* Phone shares the grid so it matches the Name field width (UAT#3 EMER-WIDTH). */}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Name" required value={emergency.name}
                onChange={(e) => setEmergency({ ...emergency, name: e.currentTarget.value })} />
              <Select label="Relationship" data={RELATIONSHIPS} value={emergency.relationship || null}
                placeholder="Select" comboboxProps={{ withinPortal: true }}
                onChange={(v) => setEmergency({ ...emergency, relationship: v || "" })} />
              <PhoneField label="Phone" value={emergency.phone}
                error={fieldErrors["emergency_contacts.0.phone"]}
                onChange={(v) => setEmergency({ ...emergency, phone: v })} />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Engagement</Title>
          <Stack gap={4}>
            <Text size="sm"><b>Type:</b> {STAFF_TYPE_LABEL[staffType] ?? staffType}</Text>
            {isEmployee && ctxQ.data?.employment_basis && (
              <Text size="sm"><b>Employment basis:</b> {BASIS_LABEL[ctxQ.data.employment_basis]}</Text>
            )}
            {ctxQ.data?.position_title && (
              <Text size="sm"><b>Position:</b> {ctxQ.data.position_title}</Text>
            )}
            {ctxQ.data?.start_date && (
              <Text size="sm"><b>Start date:</b> {dayjs(ctxQ.data.start_date).format("D MMM YYYY")}</Text>
            )}
            <Text size="xs" c="dimmed">These were set by your manager. Contact them if anything's wrong.</Text>
          </Stack>
        </Paper>

        {isEmployee && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Tax</Title>
            <Stack>
              <Select label="Residency for tax" data={[
                { value: "resident", label: "Australian resident" },
                { value: "non_resident", label: "Non-resident" },
                { value: "working_holiday_maker", label: "Working holiday maker" },
              ]} value={tax.residency} allowDeselect={false}
                onChange={(v) => setTax({ ...tax, residency: (v as never) ?? "resident" })} />
              <div>
                <TextInput label="Tax File Number" value={tax.tfn} disabled={tax.tfn_not_provided}
                  error={fieldErrors["tax.tfn"]}
                  onChange={(e) => setTax({ ...tax, tfn: e.currentTarget.value })} />
                <Checkbox mt={6} label="I have not provided a TFN" checked={tax.tfn_not_provided}
                  onChange={(e) => setTax({ ...tax, tfn_not_provided: e.currentTarget.checked })} />
              </div>
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
                  error={fieldErrors["superannuation.fund_usi"]}
                  onChange={(e) => setSupera({ ...supera, fund_usi: e.currentTarget.value })} />
              ) : (
                <TextInput label="ESA (electronic service address)" value={supera.esa}
                  onChange={(e) => setSupera({ ...supera, esa: e.currentTarget.value })} />
              )}
              <TextInput label="Fund ABN" value={supera.fund_abn}
                error={fieldErrors["superannuation.fund_abn"]}
                onChange={(e) => setSupera({ ...supera, fund_abn: e.currentTarget.value })} />
              <TextInput label="Member number" value={supera.member_number}
                onChange={(e) => setSupera({ ...supera, member_number: e.currentTarget.value })} />
              {supera.fund_type === "smsf" && (
                <>
                  <TextInput label="SMSF bank BSB" placeholder="XXX-XXX" value={supera.smsf_bank_bsb}
                    error={fieldErrors["superannuation.smsf_bank_bsb"]}
                    onChange={(e) => setSupera({ ...supera, smsf_bank_bsb: formatBsb(e.currentTarget.value) })} />
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
              <TextInput label="Account name" required value={bank.account_name}
                onChange={(e) => setBank({ ...bank, account_name: e.currentTarget.value })} />
              <TextInput label="Bank name" value={bank.bank_name}
                onChange={(e) => setBank({ ...bank, bank_name: e.currentTarget.value })} />
              <TextInput label="BSB" required placeholder="XXX-XXX" value={bank.bsb}
                error={fieldErrors["bank.bsb"]}
                onChange={(e) => setBank({ ...bank, bsb: formatBsb(e.currentTarget.value) })} />
              <TextInput label="Account number" required value={bank.account_number}
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
              <TextInput label="ABN" value={business.abn} error={fieldErrors["business.abn"]}
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
              onClick={() => setCreds([...creds, { credential_type: "wwcc", identifier: "", state_of_issue: "", expires_on: null, image_key: "" }])}>
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
                <Select w={140} label="State of issue" data={STATE_OF_ISSUE_OPTIONS}
                  value={c.state_of_issue || null} placeholder="Select" clearable searchable
                  comboboxProps={{ withinPortal: true }}
                  onChange={(v) => setCreds(creds.map((x, ix) => ix === i ? { ...x, state_of_issue: v ?? "" } : x))} />
                <DateField label="Expires" value={c.expires_on}
                  onChange={(d) => setCreds(creds.map((x, ix) => ix === i ? { ...x, expires_on: d } : x))} />
                {/* Attach a copy/photo of the credential during onboarding (CRED-1). */}
                {ctxQ.data?.storage_configured && (
                  <OnboardingCredentialUpload token={token} imageKey={c.image_key}
                    onKey={(key) => setCreds(creds.map((x, ix) => ix === i ? { ...x, image_key: key } : x))} />
                )}
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
              <TextInput label="Guardian name" required value={guardian.guardian_name}
                onChange={(e) => setGuardian({ ...guardian, guardian_name: e.currentTarget.value })} />
              <Select label="Relationship" required data={GUARDIAN_RELATIONSHIPS}
                value={guardian.relationship || null} placeholder="Select" comboboxProps={{ withinPortal: true }}
                onChange={(v) => setGuardian({ ...guardian, relationship: v || "" })} />
              <PhoneField label="Phone" required value={guardian.phone} error={fieldErrors["guardian.phone"]}
                onChange={(v) => setGuardian({ ...guardian, phone: v })} />
              <TextInput label="Email" required type="email" value={guardian.email}
                onChange={(e) => setGuardian({ ...guardian, email: e.currentTarget.value })} />
            </SimpleGrid>
            <Checkbox mt="sm" label="My parent/guardian consents to my participation" checked={guardian.consent_given}
              onChange={(e) => setGuardian({ ...guardian, consent_given: e.currentTarget.checked })} />
          </Paper>
        )}

        {/* Manager-entry sets no password — the staffer sets it via a link (PWVERIFY-1). */}
        {managerMode ? (
          <Paper withBorder p="md" bg="var(--mantine-color-default)">
            <Text size="sm" c="dimmed">
              You're entering this on the staff member's behalf. After you save, send them
              the “set password & confirm mobile” link from their profile — they choose
              their own password and PIN.
            </Text>
          </Paper>
        ) : (
          <Paper withBorder p="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>{hasAccount ? "Password & PIN" : "Set your password"}</Title>
              {authDisabled && (
                <Button variant="light" size="xs" onClick={() => setChangingAuth(true)}>
                  Change password / PIN
                </Button>
              )}
            </Group>
            {hasAccount && (
              <Text size="sm" c="dimmed" mb="sm">
                You already have an account. Leave these as-is to keep your current
                password and PIN, or choose “Change password / PIN” to update them.
              </Text>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <PasswordInput label="Password" value={password} required={!hasAccount} disabled={authDisabled}
                error={fieldErrors["password"]}
                onChange={(e) => setPassword(e.currentTarget.value)} />
              <PasswordInput label="Confirm password" value={confirm} required={!hasAccount} disabled={authDisabled}
                onChange={(e) => setConfirm(e.currentTarget.value)} />
              <TextInput label="PIN (6–8 digits)" value={pin} disabled={authDisabled}
                error={fieldErrors["pin"]}
                description="For quick check-in on shared terminals (coming soon)"
                onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, 8))} />
            </SimpleGrid>
          </Paper>
        )}

        {error && <Text c="red" size="sm">{error}</Text>}
        <Divider />
        <Group justify="flex-end">
          <Button size="md" loading={submitM.isPending} onClick={submit}>
            {managerMode ? "Create staff member" : "Finish onboarding"}
          </Button>
        </Group>
      </Stack>
      <PhoneConfirmModal token={token} phone={personal.mobile} opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onVerified={() => { setPhoneVerified(true); setConfirmOpen(false); submitM.mutate(); }} />
    </Container>
  );
}
