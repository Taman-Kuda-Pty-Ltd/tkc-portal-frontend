import {
  ActionIcon, Button, Card, Center, Checkbox, Divider, Group, NumberInput, PasswordInput,
  Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconCircleCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import { RELATIONSHIPS, GUARDIAN_RELATIONSHIPS } from "../constants/relationships";
import type { OnboardingContext } from "../api/types";
import tkcLogo from "../assets/tkc-logo-wide.png";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { PhoneConfirmModal } from "../components/PhoneConfirmModal";
import { PhoneField } from "../components/PhoneField";

const EXPERIENCE = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

// Placeholder — replace with your real liability/medical disclaimer.
const DISCLAIMER =
  "I understand horse riding carries inherent risks. I confirm the medical information above is accurate, and I accept the riding school's terms and liability waiver on behalf of this rider.";

const isMinor = (dob: Date | null) => dob !== null && dayjs().diff(dayjs(dob), "year") < 18;

interface Rider {
  is_self: boolean;
  given_name: string;
  family_name: string;
  date_of_birth: Date | null;
  gender: string | null;
  height_cm: number | "";
  weight_kg: number | "";
  riding_experience: string | null;
  medical_notes: string;
  allergies_dietary: string;
  photo_media_consent: boolean;
  notes: string;
  disclaimer_accepted: boolean;
  // Guardian (minor riders) — defaults to the account holder.
  guardian_is_holder: boolean;
  guardian_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_email: string;
}
const emptyRider = (is_self = false): Rider => ({
  is_self, given_name: "", family_name: "", date_of_birth: null, gender: null, height_cm: "", weight_kg: "",
  riding_experience: null, medical_notes: "", allergies_dietary: "", photo_media_consent: false, notes: "", disclaimer_accepted: false,
  guardian_is_holder: true, guardian_name: "", guardian_relationship: "", guardian_phone: "", guardian_email: "",
});

export function ClientOnboarding({ token, ctx }: { token: string; ctx: OnboardingContext }) {
  const [given, setGiven] = useState(ctx.given_name);
  const [family, setFamily] = useState(ctx.family_name);
  const [mobile, setMobile] = useState(ctx.mobile ?? "");
  const [address, setAddress] = useState({ line1: "", line2: "", line3: "", suburb: "", state: "", postcode: "", country: "Australia" });
  const [ec, setEc] = useState({ name: "", relationship: "", phone: "" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [noMobile, setNoMobile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requirePhone = ctx.require_phone_verification;

  const hasSelf = riders.some((r) => r.is_self);
  const update = (i: number, patch: Partial<Rider>) => setRiders(riders.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submitM = useMutation({
    mutationFn: () =>
      api.post<{ access_token: string }>(`/onboarding/${token}`, {
        given_name: given.trim(), family_name: family.trim(),
        mobile: noMobile ? null : mobile || null, no_mobile: noMobile,
        address: address.line1 || address.suburb ? address : null,
        emergency_contacts: ec.name.trim() ? [ec] : [],
        password,
        students: riders.map((r) => ({
          is_holder: r.is_self, // API field renamed to match the manual flow's is_holder

          given_name: r.is_self ? null : r.given_name.trim(),
          family_name: r.is_self ? null : r.family_name.trim(),
          date_of_birth: r.date_of_birth ? dayjs(r.date_of_birth).format("YYYY-MM-DD") : null,
          gender: r.gender,
          height_cm: r.height_cm === "" ? null : Number(r.height_cm),
          weight_kg: r.weight_kg === "" ? null : Number(r.weight_kg),
          riding_experience: r.riding_experience,
          medical_notes: r.medical_notes.trim() || null,
          allergies_dietary: r.allergies_dietary.trim() || null,
          photo_media_consent: r.photo_media_consent,
          notes: r.notes.trim() || null,
          disclaimer_accepted: r.disclaimer_accepted,
          guardian: !r.is_self && isMinor(r.date_of_birth)
            ? {
                guardian_name: r.guardian_is_holder ? null : r.guardian_name.trim() || null,
                relationship: r.guardian_relationship || null,
                phone: r.guardian_phone || null,
                email: r.guardian_email.trim() || null,
              }
            : null,
        })),
      }),
    onSuccess: () => setDone(true),
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    setError(null);
    if (!given.trim() || !family.trim()) return setError("Please enter your name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!ec.name.trim()) return setError("An emergency contact is required.");
    if (!address.line1.trim()) return setError("A postal address (line 1) is required.");
    if (riders.length === 0) return setError("Add at least one rider.");
    for (const r of riders) {
      if (!r.is_self && (!r.given_name.trim() || !r.family_name.trim())) return setError("Enter each rider's name.");
      if (!r.date_of_birth) return setError("Each rider needs a date of birth.");
      if (!r.disclaimer_accepted) return setError("Please accept the disclaimer for each rider.");
      if (!r.is_self && isMinor(r.date_of_birth)) {
        if (!r.guardian_relationship) return setError("Choose the guardian's relationship for each minor rider.");
        if (r.guardian_is_holder) {
          if (!mobile) return setError("Add your mobile — a minor rider's guardian needs a phone number.");
          if (!ctx.email) return setError("A minor rider's guardian needs an email.");
        } else {
          if (!r.guardian_name.trim()) return setError("Enter the guardian's name.");
          if (!r.guardian_phone) return setError("Each minor rider's guardian needs a phone number.");
          if (!r.guardian_email.trim()) return setError("Each minor rider's guardian needs an email.");
        }
      }
    }
    // 2FA (UAT#3 2FA-1): confirm the mobile with a code, then submit — unless opted out.
    if (requirePhone && !noMobile && !phoneVerified) {
      setConfirmOpen(true);
      return;
    }
    submitM.mutate();
  }

  if (done)
    return (
      <Center h="100vh" p="md">
        <Card withBorder maw={480} p="xl">
          <Title order={3}>You're all set</Title>
          <Text mt="sm">Thanks, {given}. Your account and riders are registered. You can close this page.</Text>
        </Card>
      </Center>
    );

  return (
    <Center p="md">
      <Stack maw={720} w="100%" py="xl">
        {/* SELFONBOARD-BRANDING */}
        <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 64, width: "auto", maxWidth: "100%", alignSelf: "center" }} />
        <Title order={2}>Set up your account</Title>
        <Text c="dimmed" size="sm">Welcome to Taman Kuda Club. Add your details and the riders on your account.</Text>

        <Card withBorder>
          <Title order={4} mb="sm">Your details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="First name" value={given} onChange={(e) => setGiven(e.currentTarget.value)} required />
            <TextInput label="Last name" value={family} onChange={(e) => setFamily(e.currentTarget.value)} required />
            <TextInput label="Email" value={ctx.email ?? ""} disabled />
            <PhoneField label="Mobile" value={mobile} disabled={noMobile}
              onChange={(v) => { setMobile(v); setPhoneVerified(false); }} />
          </SimpleGrid>
          {requirePhone && phoneVerified && !noMobile && (
            <Group gap={6} c="teal" mt={6}><IconCircleCheck size={16} /><Text size="xs" fw={500}>Mobile confirmed</Text></Group>
          )}
          {requirePhone && !phoneVerified && !noMobile && (
            <Text size="xs" c="dimmed" mt={6}>We'll text a code to confirm this when you finish.</Text>
          )}
          {requirePhone && (
            <Checkbox mt="xs" checked={noMobile}
              onChange={(e) => { setNoMobile(e.currentTarget.checked); setPhoneVerified(false); }}
              label="I don't have a mobile number (skip verification)" />
          )}
          <Divider my="sm" label="Address" labelPosition="left" />
          <Stack gap="sm">
            <AddressAutocomplete value={address.line1} token={token} required
              onChange={(line1) => setAddress({ ...address, line1 })}
              onSelect={(p) => setAddress({ ...address, line1: p.line1, line2: p.line2 || address.line2, suburb: p.suburb, state: p.state, postcode: p.postcode })} />
            <TextInput label="Address line 2" value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.currentTarget.value })} />
            <TextInput label="Address line 3" value={address.line3}
              onChange={(e) => setAddress({ ...address, line3: e.currentTarget.value })} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="Suburb" value={address.suburb}
                onChange={(e) => setAddress({ ...address, suburb: e.currentTarget.value })} />
              <TextInput label="State" value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.currentTarget.value })} />
              <TextInput label="Postcode" value={address.postcode}
                onChange={(e) => setAddress({ ...address, postcode: e.currentTarget.value })} />
            </SimpleGrid>
            <TextInput label="Country" value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.currentTarget.value })} />
          </Stack>
          <Divider my="sm" label="Emergency contact" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Name" required value={ec.name} onChange={(e) => setEc({ ...ec, name: e.currentTarget.value })} />
            <Select label="Relationship" data={RELATIONSHIPS} value={ec.relationship || null}
              placeholder="Select" clearable comboboxProps={{ withinPortal: true }}
              onChange={(v) => setEc({ ...ec, relationship: v ?? "" })} />
            <PhoneField label="Phone" value={ec.phone} onChange={(v) => setEc({ ...ec, phone: v })} />
          </SimpleGrid>
          <Divider my="sm" label="Password" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required />
            <PasswordInput label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} required />
          </SimpleGrid>
        </Card>

        <Group justify="space-between">
          <Title order={4}>Riders</Title>
          <Group gap="xs">
            {!hasSelf && (
              <Button size="xs" variant="light" onClick={() => setRiders([...riders, emptyRider(true)])}>
                I'm also a rider
              </Button>
            )}
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setRiders([...riders, emptyRider()])}>
              Add rider
            </Button>
          </Group>
        </Group>
        {riders.length === 0 && <Text size="sm" c="dimmed">Add each person who'll take lessons.</Text>}

        {riders.map((r, i) => (
          <Card key={i} withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{r.is_self ? "You (rider)" : r.given_name || `Rider ${i + 1}`}</Text>
              <ActionIcon color="red" variant="subtle" onClick={() => setRiders(riders.filter((_, idx) => idx !== i))}>
                <IconX size={16} />
              </ActionIcon>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {!r.is_self && <TextInput label="First name" value={r.given_name} onChange={(e) => update(i, { given_name: e.currentTarget.value })} required />}
              {!r.is_self && <TextInput label="Last name" value={r.family_name} onChange={(e) => update(i, { family_name: e.currentTarget.value })} required />}
              <DateInput label="Date of birth" value={r.date_of_birth} onChange={(d) => update(i, { date_of_birth: d })} valueFormat="D MMM YYYY" required />
              <Select label="Gender" data={GENDERS} value={r.gender} onChange={(v) => update(i, { gender: v })} clearable />
              <Select label="Riding experience" data={EXPERIENCE} value={r.riding_experience} onChange={(v) => update(i, { riding_experience: v })} />
              <NumberInput label="Height (cm)" min={0} value={r.height_cm} onChange={(v) => update(i, { height_cm: v === "" ? "" : Number(v) })} />
              <NumberInput label="Weight (kg)" min={0} value={r.weight_kg} onChange={(v) => update(i, { weight_kg: v === "" ? "" : Number(v) })} />
            </SimpleGrid>
            <Textarea label="Medical conditions to disclose" mt="sm" autosize minRows={3}
              value={r.medical_notes} onChange={(e) => update(i, { medical_notes: e.currentTarget.value })} />
            <Textarea label="Allergies / dietary needs" mt="sm" autosize minRows={2}
              value={r.allergies_dietary} onChange={(e) => update(i, { allergies_dietary: e.currentTarget.value })} />
            <Textarea label="Anything else" mt="sm" autosize minRows={2}
              value={r.notes} onChange={(e) => update(i, { notes: e.currentTarget.value })} />
            <Checkbox mt="sm" checked={r.photo_media_consent}
              onChange={(e) => update(i, { photo_media_consent: e.currentTarget.checked })}
              label="I consent to photos/media of this rider being used by the club" />

            {!r.is_self && isMinor(r.date_of_birth) && (
              <Card withBorder mt="sm" bg="var(--mantine-color-gray-light)">
                <Text fw={600} size="sm" mb="xs">Guardian (this rider is under 18)</Text>
                <Select label="Guardian" allowDeselect={false}
                  data={[{ value: "holder", label: `${given || "You"} (account holder)` }, { value: "other", label: "Someone else" }]}
                  value={r.guardian_is_holder ? "holder" : "other"}
                  onChange={(v) => update(i, { guardian_is_holder: v === "holder" })} />
                <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
                  <Select label="Relationship to rider" required data={GUARDIAN_RELATIONSHIPS}
                    value={r.guardian_relationship || null}
                    onChange={(v) => update(i, { guardian_relationship: v ?? "" })} />
                  {r.guardian_is_holder ? (
                    <TextInput label="Guardian contact" disabled
                      value={[mobile, ctx.email].filter(Boolean).join(" · ") || "your details"} />
                  ) : (
                    <>
                      <TextInput label="Guardian name" required value={r.guardian_name}
                        onChange={(e) => update(i, { guardian_name: e.currentTarget.value })} />
                      <PhoneField label="Guardian phone" required value={r.guardian_phone}
                        onChange={(v) => update(i, { guardian_phone: v })} />
                      <TextInput label="Guardian email" required type="email" value={r.guardian_email}
                        onChange={(e) => update(i, { guardian_email: e.currentTarget.value })} />
                    </>
                  )}
                </SimpleGrid>
                {r.guardian_is_holder && !mobile && (
                  <Text size="xs" c="orange" mt={4}>Add your mobile above so we have a guardian phone number.</Text>
                )}
              </Card>
            )}

            <Checkbox mt="sm" checked={r.disclaimer_accepted}
              onChange={(e) => update(i, { disclaimer_accepted: e.currentTarget.checked })}
              label={DISCLAIMER} />
          </Card>
        ))}

        {error && <Text c="red">{error}</Text>}
        <Group justify="flex-end">
          <Button loading={submitM.isPending} onClick={submit}>Create account</Button>
        </Group>
      </Stack>
      <PhoneConfirmModal token={token} phone={mobile} opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onVerified={() => { setPhoneVerified(true); setConfirmOpen(false); submitM.mutate(); }} />
    </Center>
  );
}
