import { Alert, Button, Group, Text, TextInput } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";

/**
 * SMS mobile-verification step for onboarding (public, token-scoped).
 *
 * "Send code" texts a 6-digit code to `phone`; a code input + "Verify" confirms
 * it. On success shows a verified state and calls `onVerifiedChange(true)`. The
 * parent owns the `verified` flag and should reset it to false whenever `phone`
 * changes (a new number needs re-verifying).
 */
export function PhoneVerification({
  token,
  phone,
  phoneValid,
  verified,
  onVerifiedChange,
  required,
}: {
  token: string;
  phone: string;
  phoneValid: boolean;
  verified: boolean;
  onVerifiedChange: (v: boolean) => void;
  required?: boolean;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; detail: string }>(`/onboarding/${token}/send-phone-code`, { phone }),
    onSuccess: () => {
      setSent(true);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const verifyM = useMutation({
    mutationFn: () =>
      api.post<{ verified: boolean }>(`/onboarding/${token}/verify-phone-code`, {
        phone,
        code: code.trim(),
      }),
    onSuccess: (res) => {
      onVerifiedChange(res.verified);
      setError(res.verified ? null : "That code is incorrect.");
    },
    onError: (e: Error) => setError(e.message),
  });

  if (verified)
    return (
      <Group gap={6} c="teal">
        <IconCircleCheck size={18} />
        <Text size="sm" fw={500}>Mobile verified</Text>
      </Group>
    );

  return (
    <div>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Button
          variant="light"
          size="xs"
          disabled={!phoneValid}
          loading={sendM.isPending}
          onClick={() => sendM.mutate()}
        >
          {sent ? "Resend code" : "Send code"}
        </Button>
        {sent && (
          <>
            <TextInput
              size="xs"
              label="Verification code"
              placeholder="6-digit code"
              value={code}
              w={150}
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button
              size="xs"
              loading={verifyM.isPending}
              disabled={code.length < 6}
              onClick={() => verifyM.mutate()}
            >
              Verify
            </Button>
          </>
        )}
      </Group>
      {!phoneValid && (
        <Text size="xs" c="dimmed" mt={4}>
          Enter your mobile number above to {required ? "verify it" : "receive a code"}.
        </Text>
      )}
      {required && !sent && phoneValid && (
        <Text size="xs" c="orange" mt={4}>
          Verifying your mobile is required to finish onboarding.
        </Text>
      )}
      {sent && !error && (
        <Text size="xs" c="dimmed" mt={4}>
          We sent a code to {phone}. Enter it above to verify.
        </Text>
      )}
      {error && (
        <Alert color="red" mt="xs" p="xs">
          <Text size="xs">{error}</Text>
        </Alert>
      )}
    </div>
  );
}
