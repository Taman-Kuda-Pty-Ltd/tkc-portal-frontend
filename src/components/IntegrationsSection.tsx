import { Button, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface IntegrationSettings {
  weatherflow_station_id: string | null;
  has_weatherflow_token: boolean;
}

export function IntegrationsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => api.get<IntegrationSettings>("/settings/integrations"),
  });
  const [stationId, setStationId] = useState("");
  const [token, setToken] = useState("");
  useEffect(() => {
    if (q.data) setStationId(q.data.weatherflow_station_id ?? "");
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.put("/settings/integrations", {
        weatherflow_station_id: stationId.trim() || null,
        // Only send a token when one was entered — blank keeps the stored value.
        weatherflow_token: token.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      setToken("");
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
      <Group>
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
      </Group>
    </Stack>
  );
}
