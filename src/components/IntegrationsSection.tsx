import { Badge, Button, Divider, Group, PasswordInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  sms_provider: string;
  clicksend_username: string | null;
  has_clicksend_api_key: boolean;
  sms_sender_id: string | null;
  sms_configured: boolean;
  address_service_url: string | null;
  has_address_api_key: boolean;
  address_configured: boolean;
  weather_status: IntegStatus;
  s3_status: IntegStatus;
  sms_status: IntegStatus;
  address_status: IntegStatus;
}

type IntegStatus = "not_configured" | "not_tested" | "configured";

// INTEG-TRISTATE: one badge for the three-state integration status.
function StatusBadge({ status }: { status?: IntegStatus }) {
  if (status === "configured") return <Badge color="teal" variant="light">Configured</Badge>;
  if (status === "not_tested") return <Badge color="yellow" variant="light">Not tested</Badge>;
  return <Badge color="gray" variant="light">Not configured</Badge>;
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
  const [sms, setSms] = useState({ provider: "log", username: "", senderId: "" });
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsTestTo, setSmsTestTo] = useState("");
  const [addressUrl, setAddressUrl] = useState("");
  const [addressApiKey, setAddressApiKey] = useState("");

  // Seed the form from the server ONCE. Later refetches (window focus, or the
  // invalidate after a save) must not clobber in-progress edits.
  const hydrated = useRef(false);
  useEffect(() => {
    if (q.data && !hydrated.current) {
      hydrated.current = true;
      setStationId(q.data.weatherflow_station_id ?? "");
      setS3({
        endpoint: q.data.s3_endpoint_url ?? "",
        accessKey: q.data.s3_access_key ?? "",
        bucket: q.data.s3_bucket ?? "",
        region: q.data.s3_region ?? "",
      });
      setSms({
        provider: q.data.sms_provider || "log",
        username: q.data.clicksend_username ?? "",
        senderId: q.data.sms_sender_id ?? "",
      });
      setAddressUrl(q.data.address_service_url ?? "");
    }
  }, [q.data]);

  const afterSave = () => {
    qc.invalidateQueries({ queryKey: ["integration-settings"] });
    qc.invalidateQueries({ queryKey: ["storage-status"] });
    qc.invalidateQueries({ queryKey: ["address-status"] });
    notifications.show({ color: "teal", message: "Saved." });
  };

  // Per-section save: each sends ONLY its own fields. The backend patches
  // (omitted fields are left untouched), so saving one section never wipes the other.
  const saveWeatherM = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        weatherflow_station_id: stationId.trim(),
        weatherflow_token: token.trim() || null, // blank keeps the stored token
      }),
    onSuccess: () => {
      setToken("");
      afterSave();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const saveS3M = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        s3_endpoint_url: s3.endpoint.trim(),
        s3_access_key: s3.accessKey.trim(),
        s3_bucket: s3.bucket.trim(),
        s3_region: s3.region.trim(),
        s3_secret_key: s3Secret.trim() || null, // blank keeps the stored secret
      }),
    onSuccess: () => {
      setS3Secret("");
      afterSave();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const saveSmsM = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        sms_provider: sms.provider,
        clicksend_username: sms.username.trim(),
        sms_sender_id: sms.senderId.trim(),
        clicksend_api_key: smsApiKey.trim() || null, // blank keeps the stored key
      }),
    onSuccess: () => {
      setSmsApiKey("");
      afterSave();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const saveAddressM = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        address_service_url: addressUrl.trim(),
        address_api_key: addressApiKey.trim() || null, // blank keeps the stored key
      }),
    onSuccess: () => {
      setAddressApiKey("");
      afterSave();
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

  // SMS: send a test via the SAVED active provider (Log logs it; ClickSend sends).
  const smsTestM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; detail: string }>("/settings/integrations/sms/test", {
        to: smsTestTo.trim(),
      }),
    onSuccess: showResult,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Address service: server-side sample /suggest against the SAVED config.
  const addressTestM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; detail: string }>("/settings/integrations/address/test"),
    onSuccess: showResult,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const weatherConfigured = !!q.data?.weatherflow_station_id && !!q.data?.has_weatherflow_token;
  const s3Configured = !!q.data?.s3_configured;
  const smsConfigured = !!q.data?.sms_configured;
  const addressConfigured = !!q.data?.address_configured;

  return (
    <Stack gap="sm">
      <Group gap="sm"><Text fw={600}>WeatherFlow (Tempest)</Text><StatusBadge status={q.data?.weather_status} /></Group>
      <Text size="sm" c="dimmed">
        Powers the weather strip on the check-in terminals. Enter your Tempest station
        id and a personal access token. The token is stored encrypted and never leaves
        the server.
      </Text>
      <TextInput label="Station id" w={280} value={stationId}
        onChange={(e) => setStationId(e.currentTarget.value)} placeholder="e.g. 211719"
        description="Numeric station id (e.g. 211719) — not the device serial (ST-… / HB-…)." />
      <PasswordInput label="API token" w={360} value={token}
        onChange={(e) => setToken(e.currentTarget.value)}
        placeholder={q.data?.has_weatherflow_token ? "•••••••• (saved — leave blank to keep)" : "Paste your token"} />
      <Group>
        <Button loading={saveWeatherM.isPending} onClick={() => saveWeatherM.mutate()}>Save WeatherFlow</Button>
        <Button variant="light" loading={weatherTestM.isPending} disabled={!weatherConfigured}
          onClick={() => weatherTestM.mutate()}>Test connection</Button>
        {!weatherConfigured && <Text size="xs" c="dimmed">Save a station id and token first.</Text>}
      </Group>
      <Divider my="sm" />

      <Group gap="xs">
        <Group gap="sm"><Text fw={600}>File storage (S3-compatible)</Text><StatusBadge status={q.data?.s3_status} /></Group>
        {q.data && (
          <Badge color={q.data.s3_configured ? "teal" : "gray"} variant="light">
            {q.data.s3_configured ? "Configured" : "Not configured"}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Stores photos and documents (horse photos, profile pictures, credential copies).
        Works with Garage, MinIO, AWS S3, or Backblaze B2. The secret key is stored encrypted and
        never leaves the server. Note: the bucket must have CORS configured to allow this
        app's origin (PUT/GET) so browsers can upload and display files directly.
      </Text>
      <Group grow>
        <TextInput label="Endpoint URL" value={s3.endpoint} placeholder="http://nas.local:3900"
          onChange={(e) => setS3({ ...s3, endpoint: e.currentTarget.value })} />
        <TextInput label="Bucket" value={s3.bucket} placeholder="tamankuda"
          onChange={(e) => setS3({ ...s3, bucket: e.currentTarget.value })} />
      </Group>
      <Group grow>
        <TextInput label="Access key" value={s3.accessKey}
          onChange={(e) => setS3({ ...s3, accessKey: e.currentTarget.value })} />
        <TextInput label="Region" value={s3.region} placeholder="garage"
          onChange={(e) => setS3({ ...s3, region: e.currentTarget.value })} />
      </Group>
      <PasswordInput label="Secret key" w={360} value={s3Secret}
        onChange={(e) => setS3Secret(e.currentTarget.value)}
        placeholder={q.data?.has_s3_secret ? "•••••••• (saved — leave blank to keep)" : "Paste the secret key"} />

      <Group>
        <Button loading={saveS3M.isPending} onClick={() => saveS3M.mutate()}>Save file storage</Button>
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
      <Divider my="sm" />

      <Group gap="xs">
        <Group gap="sm"><Text fw={600}>SMS</Text><StatusBadge status={q.data?.sms_status} /></Group>
        {q.data && (
          <Badge color={sms.provider === "clicksend" ? (q.data.sms_configured ? "teal" : "gray") : "blue"} variant="light">
            {sms.provider === "clicksend" ? (q.data.sms_configured ? "Configured" : "Not configured") : "Log (dev)"}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Sends text messages (e.g. sign-in codes, reminders). The <b>Log</b> provider records
        each message to the server log without sending — handy for development. <b>ClickSend</b>
        sends live via the ClickSend API. The API key is stored encrypted and never leaves the server.
      </Text>
      <Select label="Provider" w={280} data={[
        { value: "log", label: "Log (development — records, doesn't send)" },
        { value: "clicksend", label: "ClickSend (live)" },
      ]} value={sms.provider} onChange={(v) => setSms({ ...sms, provider: v || "log" })} allowDeselect={false} />
      {sms.provider === "clicksend" && (
        <>
          <Group grow>
            <TextInput label="ClickSend username" value={sms.username} placeholder="your ClickSend login"
              onChange={(e) => setSms({ ...sms, username: e.currentTarget.value })} />
            <TextInput label="Sender ID" value={sms.senderId} maxLength={11} placeholder="e.g. TamanKuda"
              onChange={(e) => setSms({ ...sms, senderId: e.currentTarget.value })}
              description="Max 11 chars. Must be registered with ACMA, or messages show an “Unverified” sender." />
          </Group>
          <PasswordInput label="API key" w={360} value={smsApiKey}
            onChange={(e) => setSmsApiKey(e.currentTarget.value)}
            placeholder={q.data?.has_clicksend_api_key ? "•••••••• (saved — leave blank to keep)" : "Paste the ClickSend API key"} />
        </>
      )}
      <Group align="flex-end">
        <Button loading={saveSmsM.isPending} onClick={() => saveSmsM.mutate()}>Save SMS</Button>
        <TextInput label="Send test to" w={220} value={smsTestTo} placeholder="0412 345 678"
          onChange={(e) => setSmsTestTo(e.currentTarget.value)} />
        <Button variant="light" loading={smsTestM.isPending} disabled={!smsConfigured || !smsTestTo.trim()}
          onClick={() => smsTestM.mutate()}>Send test SMS</Button>
      </Group>
      {!smsConfigured
        ? <Text size="xs" c="dimmed">Save the ClickSend username and API key first to enable the test send.</Text>
        : sms.provider === "log" && <Text size="xs" c="dimmed">Log provider: the test is written to the server log, not actually sent.</Text>}
      <Divider my="sm" />

      <Group gap="xs">
        <Group gap="sm"><Text fw={600}>Address autocomplete</Text><StatusBadge status={q.data?.address_status} /></Group>
        {q.data && (
          <Badge color={q.data.address_configured ? "teal" : "gray"} variant="light">
            {q.data.address_configured ? "Configured" : "Not configured"}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Suggests Australian addresses in the people and onboarding forms via a self-hosted
        G-NAF lookup service. Enter the service base URL (e.g. http://192.168.1.50:8000) and
        its API key. The key is stored encrypted and never leaves the server — the browser
        only ever talks to this app. When unset, address fields fall back to plain text.
      </Text>
      <TextInput label="Service URL" w={360} value={addressUrl} placeholder="http://192.168.1.50:8000"
        onChange={(e) => setAddressUrl(e.currentTarget.value)} />
      <PasswordInput label="API key" w={360} value={addressApiKey}
        onChange={(e) => setAddressApiKey(e.currentTarget.value)}
        placeholder={q.data?.has_address_api_key ? "•••••••• (saved — leave blank to keep)" : "Paste the X-API-Key"} />
      <Group>
        <Button loading={saveAddressM.isPending} onClick={() => saveAddressM.mutate()}>Save address service</Button>
        <Button variant="light" loading={addressTestM.isPending} disabled={!addressConfigured}
          onClick={() => addressTestM.mutate()}>Test connection</Button>
        {!addressConfigured && <Text size="xs" c="dimmed">Save a service URL first.</Text>}
      </Group>
    </Stack>
  );
}
