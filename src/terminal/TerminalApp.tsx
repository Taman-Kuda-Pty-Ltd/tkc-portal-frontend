import { Button, Center, Loader, PinInput, Stack, Text, Title } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckInTerminal } from "./CheckInTerminal";
import { ScheduleDisplay } from "./ScheduleDisplay";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getTerminalToken, setTerminalToken, terminalApi, TerminalError } from "./terminalApi";

/** Kiosk shell. A device self-directs from a stored token; a new/wiped device
 *  is provisioned with a one-time setup code (OTP). The old ?token= setup link
 *  still works as a fallback. No app navigation. */
export function TerminalApp() {
  const qc = useQueryClient();
  // Fallback: capture a token from a ?token= setup link, then clean the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");
    if (t) {
      setTerminalToken(t);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const [hasToken, setHasToken] = useState(() => !!getTerminalToken());
  const configQ = useQuery({
    queryKey: ["terminal-config"],
    queryFn: () => terminalApi.config(),
    retry: false,
    enabled: hasToken,
  });

  // No stored token, or the token no longer works → provision this device.
  if (!hasToken || configQ.isError) {
    return (
      <SetupScreen
        stale={configQ.isError}
        onProvisioned={() => {
          setHasToken(true);
          qc.invalidateQueries({ queryKey: ["terminal-config"] });
        }}
      />
    );
  }

  if (configQ.isLoading || !configQ.data) {
    return <Center h="100vh"><Loader /></Center>;
  }

  if (configQ.data.terminal_type === "checkin") {
    return (
      <ErrorBoundary label="The check-in screen hit an error.">
        <CheckInTerminal
          name={configQ.data.name}
          inactivitySeconds={configQ.data.inactivity_seconds}
          minHours={configQ.data.min_shift_hours}
          checkoutWindowMinutes={configQ.data.checkout_window_minutes}
          timeFormat={configQ.data.time_format}
          businessTimezone={configQ.data.business_timezone}
        />
      </ErrorBoundary>
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

function SetupScreen({ stale, onProvisioned }: { stale: boolean; onProvisioned: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await terminalApi.redeemSetupCode(value);
      setTerminalToken(res.token);
      onProvisioned();
    } catch (e) {
      setError(e instanceof TerminalError ? e.message : "Something went wrong");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center h="100vh" p="xl">
      <Stack align="center" maw={420} gap="lg">
        <Title order={2}>Set up this terminal</Title>
        <Text ta="center" c="dimmed">
          {stale
            ? "This device is no longer linked. Enter a new setup code from Settings → Terminals in the main app."
            : "In the main app open Settings → Terminals, choose this device and tap “Set up device”, then enter the 6-digit code here."}
        </Text>
        <PinInput
          length={6}
          type="number"
          inputMode="numeric"
          size="xl"
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={busy}
          oneTimeCode
          aria-label="Setup code"
        />
        {error && <Text c="red" ta="center">{error}</Text>}
        <Button size="lg" fullWidth loading={busy} disabled={code.length < 6} onClick={() => submit(code)}>
          Set up
        </Button>
      </Stack>
    </Center>
  );
}
