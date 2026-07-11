import {
  Button,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { EmailSettings, SmtpSecurity } from "../api/types";

interface Draft {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  from_email: string;
  from_name: string;
}

export function EmailSettingsSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState("");

  const q = useQuery({
    queryKey: ["email-settings"],
    queryFn: () => api.get<EmailSettings>("/settings/email"),
  });

  useEffect(() => {
    if (q.data)
      setDraft({
        enabled: q.data.enabled,
        host: q.data.host ?? "",
        port: q.data.port,
        security: q.data.security,
        username: q.data.username ?? "",
        from_email: q.data.from_email ?? "",
        from_name: q.data.from_name ?? "",
      });
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.put<EmailSettings>("/settings/email", {
        ...draft,
        host: draft!.host || null,
        username: draft!.username || null,
        from_email: draft!.from_email || null,
        from_name: draft!.from_name || null,
        password: password || null,
      }),
    onSuccess: () => {
      setPassword("");
      qc.invalidateQueries({ queryKey: ["email-settings"] });
      notifications.show({ color: "teal", message: "Email settings saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const testM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; detail: string }>("/settings/email/test", { to: testTo }),
    onSuccess: (res) =>
      notifications.show({ color: res.ok ? "teal" : "red", message: res.detail, autoClose: 8000 }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading || !draft) return <Loader />;

  // Match the Integrations test-button convention: the test uses the SAVED config,
  // so it's only enabled once email is enabled + a host/from-address are saved AND
  // there are no unsaved edits (UAT#3 EMAIL-2).
  const emailConfigured = !!q.data?.enabled && !!q.data?.host && !!q.data?.from_email;
  const dirty =
    draft.enabled !== q.data!.enabled ||
    draft.host !== (q.data!.host ?? "") ||
    draft.port !== q.data!.port ||
    draft.security !== q.data!.security ||
    draft.username !== (q.data!.username ?? "") ||
    draft.from_email !== (q.data!.from_email ?? "") ||
    draft.from_name !== (q.data!.from_name ?? "") ||
    password.length > 0;
  const canTest = !!testTo.trim() && emailConfigured && !dirty;

  return (
    <Stack gap="sm">
      <Text fw={600}>Email (SMTP)</Text>
      <Text size="sm" c="dimmed">
        SMTP server used to send onboarding invitations and notifications. The
        password is stored encrypted and never shown back.
      </Text>
      <Switch
        label="Email enabled"
        checked={draft.enabled}
        onChange={(e) => setDraft({ ...draft, enabled: e.currentTarget.checked })}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="SMTP host"
          placeholder="smtp.example.com"
          value={draft.host}
          onChange={(e) => setDraft({ ...draft, host: e.currentTarget.value })}
        />
        <NumberInput
          label="Port"
          value={draft.port}
          onChange={(v) => setDraft({ ...draft, port: Number(v) || 587 })}
        />
        <Select
          label="Security"
          data={[
            { value: "starttls", label: "STARTTLS (587)" },
            { value: "ssl", label: "SSL/TLS (465)" },
            { value: "none", label: "None" },
          ]}
          value={draft.security}
          onChange={(v) => setDraft({ ...draft, security: (v as SmtpSecurity) ?? "starttls" })}
          allowDeselect={false}
        />
        <TextInput
          label="Username"
          value={draft.username}
          onChange={(e) => setDraft({ ...draft, username: e.currentTarget.value })}
        />
        <PasswordInput
          label="Password"
          placeholder={q.data?.has_password ? "•••••••• (unchanged)" : "SMTP password"}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <TextInput
          label="From name"
          value={draft.from_name}
          onChange={(e) => setDraft({ ...draft, from_name: e.currentTarget.value })}
        />
        <TextInput
          label="From email"
          placeholder="noreply@tamankuda.club"
          value={draft.from_email}
          onChange={(e) => setDraft({ ...draft, from_email: e.currentTarget.value })}
        />
      </SimpleGrid>

      <Group align="flex-end" gap="sm">
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>
          Save email
        </Button>
        <TextInput
          label="Send test to"
          placeholder="you@example.com"
          value={testTo}
          onChange={(e) => setTestTo(e.currentTarget.value)}
          w={240}
        />
        <Button
          variant="light"
          loading={testM.isPending}
          disabled={!canTest}
          onClick={() => testM.mutate()}
        >
          Send test
        </Button>
      </Group>
      {!emailConfigured ? (
        <Text size="xs" c="dimmed">
          Enable email and save a host and from-address first to send a test.
        </Text>
      ) : dirty ? (
        <Text size="xs" c="dimmed">Save your changes first — the test uses the saved settings.</Text>
      ) : null}
    </Stack>
  );
}
