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

  return (
    <Stack gap="sm">
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

      <Group>
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>
          Save
        </Button>
      </Group>

      <Group align="flex-end" gap="sm" mt="xs">
        <TextInput
          label="Send a test email to"
          placeholder="you@example.com"
          value={testTo}
          onChange={(e) => setTestTo(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <Button
          variant="light"
          loading={testM.isPending}
          disabled={!testTo}
          onClick={() => testM.mutate()}
        >
          Send test
        </Button>
      </Group>
    </Stack>
  );
}
