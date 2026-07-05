import {
  ActionIcon, Button, Card, Center, Checkbox, Divider, Group, NumberInput, PasswordInput,
  Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { OnboardingContext } from "../api/types";

const EXPERIENCE = [
  { value: "never_ridden", label: "Never ridden" },
  { value: "beginner", label: "Beginner" },
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// Placeholder — replace with your real liability/medical disclaimer.
const DISCLAIMER =
  "I understand horse riding carries inherent risks. I confirm the medical information above is accurate, and I accept the riding school's terms and liability waiver on behalf of this rider.";

interface Rider {
  is_self: boolean;
  given_name: string;
  family_name: string;
  date_of_birth: Date | null;
  height_cm: number | "";
  weight_kg: number | "";
  riding_experience: string | null;
  medical_notes: string;
  notes: string;
  disclaimer_accepted: boolean;
}
const emptyRider = (is_self = false): Rider => ({
  is_self, given_name: "", family_name: "", date_of_birth: null, height_cm: "", weight_kg: "",
  riding_experience: null, medical_notes: "", notes: "", disclaimer_accepted: false,
});

export function ClientOnboarding({ token, ctx }: { token: string; ctx: OnboardingContext }) {
  const [given, setGiven] = useState(ctx.given_name);
  const [family, setFamily] = useState(ctx.family_name);
  const [mobile, setMobile] = useState(ctx.mobile ?? "");
  const [ec, setEc] = useState({ name: "", relationship: "", phone: "" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const hasSelf = riders.some((r) => r.is_self);
  const update = (i: number, patch: Partial<Rider>) => setRiders(riders.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submitM = useMutation({
    mutationFn: () =>
      api.post<{ access_token: string }>(`/onboarding/${token}`, {
        given_name: given.trim(), family_name: family.trim(), mobile: mobile || null,
        emergency_contacts: ec.name.trim() ? [ec] : [],
        password,
        students: riders.map((r) => ({
          is_self: r.is_self,
          given_name: r.is_self ? null : r.given_name.trim(),
          family_name: r.is_self ? null : r.family_name.trim(),
          date_of_birth: r.date_of_birth ? dayjs(r.date_of_birth).format("YYYY-MM-DD") : null,
          height_cm: r.height_cm === "" ? null : Number(r.height_cm),
          weight_kg: r.weight_kg === "" ? null : Number(r.weight_kg),
          riding_experience: r.riding_experience,
          medical_notes: r.medical_notes.trim() || null,
          notes: r.notes.trim() || null,
          disclaimer_accepted: r.disclaimer_accepted,
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
    if (riders.length === 0) return setError("Add at least one rider.");
    for (const r of riders) {
      if (!r.is_self && (!r.given_name.trim() || !r.family_name.trim())) return setError("Enter each rider's name.");
      if (!r.date_of_birth) return setError("Each rider needs a date of birth.");
      if (!r.disclaimer_accepted) return setError("Please accept the disclaimer for each rider.");
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
        <Title order={2}>Set up your account</Title>
        <Text c="dimmed" size="sm">Welcome to Taman Kuda Club. Add your details and the riders on your account.</Text>

        <Card withBorder>
          <Title order={4} mb="sm">Your details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="First name" value={given} onChange={(e) => setGiven(e.currentTarget.value)} required />
            <TextInput label="Last name" value={family} onChange={(e) => setFamily(e.currentTarget.value)} required />
            <TextInput label="Email" value={ctx.email ?? ""} disabled />
            <TextInput label="Mobile" value={mobile} onChange={(e) => setMobile(e.currentTarget.value)} />
          </SimpleGrid>
          <Divider my="sm" label="Emergency contact" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Name" value={ec.name} onChange={(e) => setEc({ ...ec, name: e.currentTarget.value })} />
            <TextInput label="Relationship" value={ec.relationship} onChange={(e) => setEc({ ...ec, relationship: e.currentTarget.value })} />
            <TextInput label="Phone" value={ec.phone} onChange={(e) => setEc({ ...ec, phone: e.currentTarget.value })} />
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
              <Select label="Riding experience" data={EXPERIENCE} value={r.riding_experience} onChange={(v) => update(i, { riding_experience: v })} />
              <NumberInput label="Height (cm)" min={0} value={r.height_cm} onChange={(v) => update(i, { height_cm: v === "" ? "" : Number(v) })} />
              <NumberInput label="Weight (kg)" min={0} value={r.weight_kg} onChange={(v) => update(i, { weight_kg: v === "" ? "" : Number(v) })} />
            </SimpleGrid>
            <Textarea label="Medical conditions to disclose" mt="sm" autosize minRows={2}
              value={r.medical_notes} onChange={(e) => update(i, { medical_notes: e.currentTarget.value })} />
            <Textarea label="Anything else" mt="sm" autosize minRows={1}
              value={r.notes} onChange={(e) => update(i, { notes: e.currentTarget.value })} />
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
    </Center>
  );
}
