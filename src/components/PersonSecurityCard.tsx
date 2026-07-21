import { Badge, Button, Card, Group, PinInput, Stack, Switch, Text, Title } from "@mantine/core";
import { IconShieldCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { PersonDetail } from "../api/types";

/** PORTAL-SECURITY (per-account): mobile verification state + a manual verify flow, and
 * the per-account 2FA toggle (only enableable once the mobile is verified). */
export function PersonSecurityCard({ person }: { person: PersonDetail }) {
  const qc = useQueryClient();
  const p = person;
  const [entering, setEntering] = useState(false);
  const [code, setCode] = useState("");
  const verified = Boolean(p.mobile_verified_at);

  const refresh = () => qc.invalidateQueries({ queryKey: ["person"] });

  const sendM = useMutation({
    mutationFn: () => api.post(`/people/${p.id}/send-mobile-verification`, {}),
    onSuccess: () => { setEntering(true); setCode(""); notifications.show({ color: "teal", message: "Verification code sent." }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const verifyM = useMutation({
    mutationFn: () => api.post(`/people/${p.id}/verify-mobile`, { code }),
    onSuccess: () => { setEntering(false); setCode(""); refresh(); notifications.show({ color: "teal", message: "Mobile verified." }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const twoFaM = useMutation({
    mutationFn: (enabled: boolean) => api.put(`/people/${p.id}/two-factor`, { enabled }),
    onSuccess: () => { refresh(); notifications.show({ color: "teal", message: "Saved." }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Card withBorder>
      <Group gap={8} mb="sm">
        <IconShieldCheck size={18} />
        <Title order={4}>Portal security</Title>
      </Group>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text size="sm" fw={500}>Mobile verification</Text>
            <Text size="xs" c="dimmed">{p.mobile || "No mobile on file"}</Text>
          </div>
          <Group gap="xs">
            {verified ? (
              <Badge color="teal" variant="light">Verified {dayjs(p.mobile_verified_at!).format("D MMM YYYY")}</Badge>
            ) : (
              <Badge color="orange" variant="light">Not verified</Badge>
            )}
            {p.mobile && !entering && (
              <Button size="xs" variant="light" loading={sendM.isPending}
                onClick={() => sendM.mutate()}>
                {verified ? "Re-verify" : "Send code"}
              </Button>
            )}
          </Group>
        </Group>

        {entering && (
          <Group gap="xs" align="flex-end">
            <div>
              <Text size="xs" c="dimmed" mb={4}>Enter the 6-digit code</Text>
              <PinInput length={6} type="number" value={code} onChange={setCode} oneTimeCode />
            </div>
            <Button size="sm" loading={verifyM.isPending} disabled={code.length < 6}
              onClick={() => verifyM.mutate()}>Verify</Button>
            <Button size="sm" variant="subtle" onClick={() => setEntering(false)}>Cancel</Button>
          </Group>
        )}

        <Switch
          label="Two-factor at sign-in for this account"
          description={verified ? "Send an SMS code on each portal sign-in." : "Verify the mobile above first to enable."}
          checked={Boolean(p.two_factor_enabled)}
          disabled={!verified || twoFaM.isPending}
          onChange={(e) => twoFaM.mutate(e.currentTarget.checked)}
        />
      </Stack>
    </Card>
  );
}
