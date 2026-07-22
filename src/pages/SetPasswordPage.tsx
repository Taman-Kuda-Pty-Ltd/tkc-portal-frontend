import { Alert, Button, Card, Center, Checkbox, Loader, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, setToken } from "../api/client";
import { PhoneConfirmModal } from "../components/PhoneConfirmModal";
import { PhoneField, isValidPhoneNumber } from "../components/PhoneField";
import tkcLogo from "../assets/tkc-logo-wide.png";

interface Ctx { given_name: string; mobile: string | null; require_phone_verification: boolean; mobile_locked?: boolean }

/** Public set-password + confirm-mobile page (UAT#3 PWVERIFY-1). Reached from a link
 *  emailed to a manually-created person so they can choose their own password/PIN and
 *  confirm their mobile, then they're logged in. */
export function SetPasswordPage() {
  const { token = "" } = useParams();
  const ctxQ = useQuery({
    queryKey: ["set-password", token],
    queryFn: () => api.get<Ctx>(`/onboarding/set-password/${token}`),
    retry: false,
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [mobile, setMobile] = useState("");
  const [noMobile, setNoMobile] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (ctxQ.data) setMobile(ctxQ.data.mobile ?? ""); }, [ctxQ.data]);

  const submitM = useMutation({
    mutationFn: () =>
      api.post<{ access_token: string }>(`/onboarding/set-password/${token}`, {
        password, pin: pin || null, mobile: noMobile ? null : mobile || null, no_mobile: noMobile,
      }),
    onSuccess: (res) => {
      setToken(res.access_token);
      window.location.assign("/schedule");
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e.message : e.message),
  });

  // RESET-HARDEN (T5-08): a verified mobile is locked — reset verifies against it.
  const mobileLocked = !!ctxQ.data?.mobile_locked;
  const requirePhone = !!ctxQ.data?.require_phone_verification || mobileLocked;

  function submit() {
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (pin && !/^\d{6,8}$/.test(pin)) return setError("PIN must be 6–8 digits.");
    if (!noMobile && !isValidPhoneNumber(mobile)) return setError("Enter a valid mobile, or tick that you don't have one.");
    if (requirePhone && !noMobile && !verified) { setConfirmOpen(true); return; }
    submitM.mutate();
  }

  if (ctxQ.isLoading) return <Center h="100vh"><Loader /></Center>;
  if (ctxQ.isError)
    return (
      <Center h="100vh" p="md">
        <Card withBorder p="xl" maw={420}>
          <Title order={3}>Link unavailable</Title>
          <Text c="dimmed" mt="sm">This set-password link is invalid, has expired, or was already used. Please ask a manager for a new one.</Text>
        </Card>
      </Center>
    );

  return (
    <Center h="100vh" p="md">
      <Stack align="center" w={420} maw="100%">
        {/* SETPW-BRANDING: logo above the card, prominent personalised greeting. */}
        <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 56, width: "auto", maxWidth: "100%" }} />
        <Card withBorder shadow="sm" padding="xl" w="100%">
        <Stack>
          <div>
            <Text fw={700} fz="lg">Hi {ctxQ.data?.given_name} 👋</Text>
            <Title order={4} mt={2}>Set up your sign-in</Title>
            <Text size="sm" c="dimmed" mt={4}>Choose a password and confirm your mobile number.</Text>
          </div>
          <PasswordInput label="Password" value={password} required onChange={(e) => setPassword(e.currentTarget.value)} />
          <PasswordInput label="Confirm password" value={confirm} required onChange={(e) => setConfirm(e.currentTarget.value)} />
          <TextInput label="PIN (6–8 digits)" value={pin} description="For quick check-in on shared terminals"
            onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, 8))} />
          <PhoneField label="Mobile" value={mobile} disabled={noMobile || mobileLocked}
            onChange={(v) => { setMobile(v); setVerified(false); }} />
          {mobileLocked && (
            <Text size="xs" c="dimmed">
              For your security we’ll text a code to the mobile on your account to confirm this reset.
            </Text>
          )}
          {/* Always offer the no-mobile opt-out — otherwise, with 2FA off (so no
              verification step), the "enter a valid mobile, or tick that you don't
              have one" error is a dead end with no tickbox (SETPW-NO-MOBILE-OPTOUT).
              A verified/locked account can't opt out — the reset must be confirmed. */}
          {!mobileLocked && (
            <Checkbox checked={noMobile} onChange={(e) => { setNoMobile(e.currentTarget.checked); setVerified(false); }}
              label={requirePhone ? "I don't have a mobile number (skip verification)" : "I don't have a mobile number"} />
          )}
          {error && <Alert color="red" p="xs"><Text size="xs">{error}</Text></Alert>}
          <Button loading={submitM.isPending} onClick={submit}>Set password &amp; sign in</Button>
        </Stack>
      </Card>
      </Stack>
      <PhoneConfirmModal token={token} phone={mobile} opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onVerified={() => { setVerified(true); setConfirmOpen(false); submitM.mutate(); }} />
    </Center>
  );
}
