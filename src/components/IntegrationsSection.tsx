import { Badge, Button, Divider, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface IntegrationSettings {
  weatherflow_station_id: string | null;
  has_weatherflow_token: boolean;
  s3_endpoint_url: string | null;
  s3_access_key: string | null;
  s3_bucket: string | null;
  s3_region: string | null;
  has_s3_secret: boolean;
  s3_configured: boolean;
}

export function IntegrationsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => api.get<IntegrationSettings>("/settings/integrations"),
  });
  const [stationId, setStationId] = useState("");
  const [token, setToken] = useState("");
  const [s3, setS3] = useState({ endpoint: "", accessKey: "", bucket: "", region: "" });
  const [s3Secret, setS3Secret] = useState("");
  useEffect(() => {
    if (q.data) {
      setStationId(q.data.weatherflow_station_id ?? "");
      setS3({
        endpoint: q.data.s3_endpoint_url ?? "",
        accessKey: q.data.s3_access_key ?? "",
        bucket: q.data.s3_bucket ?? "",
        region: q.data.s3_region ?? "",
      });
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        weatherflow_station_id: stationId.trim() || null,
        // Only send a token when one was entered — blank keeps the stored value.
        weatherflow_token: token.trim() || null,
        s3_endpoint_url: s3.endpoint.trim() || null,
        s3_access_key: s3.accessKey.trim() || null,
        s3_bucket: s3.bucket.trim() || null,
        s3_region: s3.region.trim() || null,
        // Only send the secret when one was entered — blank keeps the stored value.
        s3_secret_key: s3Secret.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      qc.invalidateQueries({ queryKey: ["storage-status"] });
      setToken("");
      setS3Secret("");
      notifications.show({ color: "teal", message: "Saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const showResult = (res: { ok: boolean; detail: string }) =>
    notifications.show({ color: res.ok ? "teal" : "red", message: res.detail, autoClose: 8000 });

  // WeatherFlow: server-side live fetch of the SAVED station id + token.
  const weatherTestM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; detail: string }>("/settings/integrations/weather/test"),
    onSuccess: showResult,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // S3: server-side round-trip probe of the SAVED config (put/get/delete).
  const s3TestM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; detail: string }>("/settings/integrations/s3/test"),
    onSuccess: showResult,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // S3 CORS: a real browser upload + read-back straight against the bucket —
  // this is the only way to catch a CORS misconfiguration (the server test can't).
  const s3CorsM = useMutation({
    mutationFn: async () => {
      const { put_url, get_url, key } = await api.post<{ put_url: string; get_url: string; key: string }>(
        "/settings/integrations/s3/browser-check",
      );
      try {
        const blob = new Blob(["tkc-cors-check"], { type: "text/plain" });
        const put = await fetch(put_url, { method: "PUT", body: blob, headers: { "Content-Type": "text/plain" } });
        if (!put.ok) throw new Error(`upload rejected (HTTP ${put.status})`);
        const get = await fetch(get_url);
        if (!get.ok) throw new Error(`read-back rejected (HTTP ${get.status})`);
        return "Browser upload + read-back succeeded — CORS is configured correctly.";
      } finally {
        // Best-effort cleanup of the throwaway object (server-side delete).
        api.post("/settings/integrations/s3/browser-check/cleanup", { key }).catch(() => {});
      }
    },
    onSuccess: (message) => notifications.show({ color: "teal", message, autoClose: 8000 }),
    onError: (e: Error) =>
      notifications.show({
        color: "red",
        message: `Browser CORS/upload check failed: ${e.message}. Ensure the bucket allows this app's origin (PUT/GET).`,
        autoClose: 10000,
      }),
  });

  const weatherConfigured = !!q.data?.weatherflow_station_id && !!q.data?.has_weatherflow_token;
  const s3Configured = !!q.data?.s3_configured;

  return (
    <Stack gap="sm">
      <Text fw={600}>WeatherFlow (Tempest)</Text>
      <Text size="sm" c="dimmed">
        Powers the weather strip on the check-in terminals. Enter your Tempest station
        id and a personal access token. The token is stored encrypted and never leaves
        the server.
      </Text>
      <TextInput label="Station id" w={220} value={stationId}
        onChange={(e) => setStationId(e.currentTarget.value)} placeholder="e.g. 211719" />
      <PasswordInput label="API token" w={360} value={token}
        onChange={(e) => setToken(e.currentTarget.value)}
        placeholder={q.data?.has_weatherflow_token ? "•••••••• (saved — leave blank to keep)" : "Paste your token"} />
      <Group>
        <Button variant="light" loading={weatherTestM.isPending} disabled={!weatherConfigured}
          onClick={() => weatherTestM.mutate()}>Test connection</Button>
        {!weatherConfigured && <Text size="xs" c="dimmed">Save a station id and token first.</Text>}
      </Group>
      <Divider my="sm" />

      <Group gap="xs">
        <Text fw={600}>File storage (S3-compatible)</Text>
        {q.data && (
          <Badge color={q.data.s3_configured ? "teal" : "gray"} variant="light">
            {q.data.s3_configured ? "Configured" : "Not configured"}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Stores photos and documents (horse photos, profile pictures, credential copies).
        Works with MinIO, AWS S3, or Backblaze B2. The secret key is stored encrypted and
        never leaves the server. Note: the bucket must have CORS configured to allow this
        app's origin (PUT/GET) so browsers can upload and display files directly.
      </Text>
      <Group grow>
        <TextInput label="Endpoint URL" value={s3.endpoint} placeholder="https://minio.example.com"
          onChange={(e) => setS3({ ...s3, endpoint: e.currentTarget.value })} />
        <TextInput label="Bucket" value={s3.bucket} placeholder="tamankuda"
          onChange={(e) => setS3({ ...s3, bucket: e.currentTarget.value })} />
      </Group>
      <Group grow>
        <TextInput label="Access key" value={s3.accessKey}
          onChange={(e) => setS3({ ...s3, accessKey: e.currentTarget.value })} />
        <TextInput label="Region" value={s3.region} placeholder="us-east-1"
          onChange={(e) => setS3({ ...s3, region: e.currentTarget.value })} />
      </Group>
      <PasswordInput label="Secret key" w={360} value={s3Secret}
        onChange={(e) => setS3Secret(e.currentTarget.value)}
        placeholder={q.data?.has_s3_secret ? "•••••••• (saved — leave blank to keep)" : "Paste the secret key"} />

      <Group>
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
        <Button variant="light" loading={s3TestM.isPending} disabled={!s3Configured}
          onClick={() => s3TestM.mutate()}>Test connection</Button>
        <Button variant="light" loading={s3CorsM.isPending} disabled={!s3Configured}
          onClick={() => s3CorsM.mutate()}>Test browser upload (CORS)</Button>
      </Group>
      {!s3Configured && <Text size="xs" c="dimmed">Save the S3 fields first to enable the connection tests.</Text>}
      <Text size="xs" c="dimmed">
        “Test connection” checks the server can reach the bucket; “Test browser upload” does a real
        upload + read-back from this browser to catch a CORS misconfiguration.
      </Text>
    </Stack>
  );
}
