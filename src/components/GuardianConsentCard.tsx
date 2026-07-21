import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconShieldCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../api/client";
import type { PersonDetail } from "../api/types";

/** MINOR-STAFF-CONSENT: for a minor worker, show the guardian consent state and let a
 * manager (re)send the notice or confirm consent in person. */
export function GuardianConsentCard({ person }: { person: PersonDetail }) {
  const qc = useQueryClient();
  const g = person.guardian;
  const confirmed = !!g?.manager_confirmed_at;
  const refresh = () => qc.invalidateQueries({ queryKey: ["person"] });

  const sendM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; detail: string }>(`/people/${person.id}/guardian-consent/send-notice`, {}),
    onSuccess: (r) => { refresh(); notifications.show({ color: r.ok ? "teal" : "orange", message: r.detail }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const confirmM = useMutation({
    mutationFn: () => api.post(`/people/${person.id}/guardian-consent/confirm`, {}),
    onSuccess: () => { refresh(); notifications.show({ color: "teal", message: "Consent confirmed." }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Card withBorder>
      <Group gap={8} mb="sm">
        <IconShieldCheck size={18} />
        <Title order={4}>Guardian consent (under 18)</Title>
        {confirmed
          ? <Badge color="teal" variant="light">Confirmed {dayjs(g!.manager_confirmed_at!).format("D MMM YYYY")}</Badge>
          : <Badge color="orange" variant="light">Not confirmed</Badge>}
      </Group>
      <Stack gap={4}>
        <Text size="sm">
          Guardian: <b>{g?.guardian_name || "—"}</b>{g?.relationship ? ` (${g.relationship})` : ""}
        </Text>
        <Text size="xs" c="dimmed">
          {[g?.email, g?.phone].filter(Boolean).join(" · ") || "No guardian contact on file"}
        </Text>
        <Text size="xs" c="dimmed">
          {g?.notice_sent_at ? `Notice sent ${dayjs(g.notice_sent_at).format("D MMM YYYY, HH:mm")}` : "Notice not sent yet"}
        </Text>
        <Group mt="xs">
          <Button size="xs" variant="light" loading={sendM.isPending} disabled={!g?.email}
            onClick={() => sendM.mutate()}>
            {g?.notice_sent_at ? "Resend notice" : "Send notice"}
          </Button>
          {!confirmed && (
            <Button size="xs" loading={confirmM.isPending} onClick={() => confirmM.mutate()}>
              Confirm consent (seen in person)
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
