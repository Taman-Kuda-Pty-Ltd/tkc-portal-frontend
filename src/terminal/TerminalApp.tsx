import { Center, Loader, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckInTerminal } from "./CheckInTerminal";
import { ScheduleDisplay } from "./ScheduleDisplay";
import { getTerminalToken, setTerminalToken, terminalApi } from "./terminalApi";

/** Kiosk shell. Reads a device token (from a ?token= setup link, stored on the
 *  device) and renders the locked terminal for its type. No app navigation. */
export function TerminalApp() {
  // Capture the token from the setup link, then clean it out of the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");
    if (t) {
      setTerminalToken(t);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const hasToken = !!getTerminalToken();
  const configQ = useQuery({
    queryKey: ["terminal-config"],
    queryFn: () => terminalApi.config(),
    retry: false,
    enabled: hasToken,
  });

  if (!hasToken || configQ.isError) {
    return (
      <Center h="100vh" p="xl">
        <Stack align="center" maw={460}>
          <Title order={2}>Terminal not set up</Title>
          <Text ta="center" c="dimmed">
            Open the setup link for this device from{" "}
            <b>Settings → Terminals</b> in the main app. If it was set up before,
            the device may have been removed or deactivated.
          </Text>
        </Stack>
      </Center>
    );
  }

  if (configQ.isLoading || !configQ.data) {
    return <Center h="100vh"><Loader /></Center>;
  }

  if (configQ.data.terminal_type === "checkin") {
    return (
      <CheckInTerminal
        name={configQ.data.name}
        inactivitySeconds={configQ.data.inactivity_seconds}
        minHours={configQ.data.min_shift_hours}
      />
    );
  }
  if (configQ.data.terminal_type === "schedule") {
    return <ScheduleDisplay name={configQ.data.name} />;
  }
  return (
    <Center h="100vh">
      <Text c="dimmed">Terminal type “{configQ.data.terminal_type}” isn’t available yet.</Text>
    </Center>
  );
}
