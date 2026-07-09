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
      </Group>
    </Stack>
  );
}
