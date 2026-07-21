import { Alert, Button, Group, NumberInput, Stack, Switch, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

/** PORTAL-SECURITY: portal sign-in security lives here (moved out of Timekeeping) —
 * the org-wide 2FA policy and the session length. Per-account 2FA + mobile verification
 * are on each person's profile. It reads/writes the shared /settings/org singleton and
 * echoes back every field, so it never clobbers the operational settings. */
export function PortalSecuritySection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<Record<string, unknown>>("/settings/org"),
  });
  const [require2fa, setRequire2fa] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState<number | string>(720);
  useEffect(() => {
    if (q.data) {
      setRequire2fa(Boolean(q.data.require_onboarding_2fa));
      setSessionMinutes(Number(q.data.portal_session_minutes) || 720);
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.put("/settings/org", {
        ...q.data, // preserve every operational field
        require_onboarding_2fa: require2fa,
        portal_session_minutes: Number(sessionMinutes) || 720,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      notifications.show({ color: "teal", message: "Saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const hours = Math.round((Number(sessionMinutes) / 60) * 10) / 10;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Require people to verify their mobile with an SMS code before they can finish
        onboarding. New accounts get this by default. Per-account 2FA and manual mobile
        verification are on each person's profile.
      </Text>
      <Switch label="Require mobile verification (2FA) at onboarding" checked={require2fa}
        onChange={(e) => setRequire2fa(e.currentTarget.checked)} />

      <Text size="sm" c="dimmed" mt="xs">
        How long a portal sign-in stays valid before the person has to log in again.
        Shorter is more secure; longer is more convenient (default 12 hours).
      </Text>
      <Group align="flex-end" gap="xs">
        <NumberInput label="Session length (minutes)" min={5} max={43200} step={30} w={220}
          value={sessionMinutes} onChange={setSessionMinutes} />
        <Text size="sm" c="dimmed" pb={8}>≈ {hours} h</Text>
      </Group>

      <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} mt="xs">
        <Text size="xs">
          Sign-in tokens are signed with the server's secret key and expire after the
          session length above. The signing key is managed in the server environment, not
          from here, so it can't be exposed or changed in the browser.
        </Text>
      </Alert>

      <Group>
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
      </Group>
    </Stack>
  );
}
