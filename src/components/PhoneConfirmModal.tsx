import { Alert, Button, Group, Modal, PinInput, Stack, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * Pre-submit mobile confirmation (UAT#3 2FA-1). Opened when the user finishes the
 * onboarding form: it texts a 6-digit code to `phone`, takes the code, and on a
 * correct entry calls `onVerified()` — the parent then submits the form (with the
 * mobile now verified server-side). Auto-sends the code on open.
 */
export function PhoneConfirmModal({
  token,
  phone,
  opened,
  onClose,
  onVerified,
}: {
  token: string;
  phone: string;
  opened: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentOnce, setSentOnce] = useState(false);

  const sendM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; detail: string }>(`/onboarding/${token}/send-phone-code`, { phone }),
    onSuccess: () => { setSentOnce(true); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const verifyM = useMutation({
    mutationFn: () => api.post<{ verified: boolean }>(`/onboarding/${token}/verify-phone-code`, { phone, code: code.trim() }),
    onSuccess: (res) => {
      if (res.verified) onVerified();
      else setError("That code is incorrect. Check it and try again.");
    },
    onError: (e: Error) => setError(e.message),
  });

  // Auto-send the code the first time the modal opens.
  useEffect(() => {
    if (opened && !sentOnce && !sendM.isPending) sendM.mutate();
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  const masked = phone ? `•••• ••• ${phone.slice(-3)}` : "your mobile";

  return (
    <Modal opened={opened} onClose={onClose} title="Confirm your mobile number" centered>
      <Stack>
        <Text size="sm">
          We've sent a 6-digit code to <b>{masked}</b>. Enter it to confirm your number and finish.
          The code is valid for 10 minutes.
        </Text>
        <PinInput length={6} type="number" oneTimeCode value={code}
          onChange={(v) => { setCode(v); setError(null); }} aria-label="Verification code" />
        {error && <Alert color="red" p="xs"><Text size="xs">{error}</Text></Alert>}
        <Group justify="space-between">
          <Button variant="subtle" size="sm" loading={sendM.isPending} onClick={() => sendM.mutate()}>
            Resend code
          </Button>
          <Group gap="xs">
            <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" loading={verifyM.isPending} disabled={code.length < 6}
              onClick={() => verifyM.mutate()}>Confirm &amp; finish</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
