import {
  Anchor,
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import tkcLogo from "../assets/tkc-logo-wide.png";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // LOGIN-RESET: forgotten-password self-service.
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [resetSent, setResetSent] = useState(false);

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setResetSent(true);
    } catch {
      // Never reveal whether the account exists — show the same confirmation.
      setResetSent(true);
    }
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect email or password.");
      } else if (err instanceof ApiError) {
        setError(`Server error (${err.status}). Is the database seeded?`);
      } else {
        setError("Can't reach the server. Is the backend running on :8000?");
      }
      setBusy(false);
    }
  }

  if (mode === "reset") {
    return (
      <Center h="100vh" p="md">
        <Card withBorder shadow="sm" padding="xl" w={360} maw="100%">
          <form onSubmit={submitReset}>
            <Stack>
              <Stack align="center" gap={4}>
                <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 84, width: "auto", maxWidth: "100%" }} />
                <Text size="sm" c="dimmed">Reset your password</Text>
              </Stack>
              {resetSent ? (
                <>
                  <Text size="sm">
                    If <b>{email}</b> has an account, we've emailed a link to set a new
                    password (and PIN). Check your inbox.
                  </Text>
                  <Anchor size="sm" onClick={() => { setMode("signin"); setResetSent(false); }}>
                    ← Back to sign in
                  </Anchor>
                </>
              ) : (
                <>
                  <Text size="sm" c="dimmed">
                    Enter your account email and we'll send you a link to set a new password.
                  </Text>
                  <TextInput label="Email" type="email" value={email} required autoFocus
                    onChange={(e) => setEmail(e.currentTarget.value)} />
                  <Button type="submit" loading={busy} fullWidth>Send reset link</Button>
                  <Anchor size="sm" ta="center" onClick={() => { setMode("signin"); setError(null); }}>
                    ← Back to sign in
                  </Anchor>
                </>
              )}
            </Stack>
          </form>
        </Card>
      </Center>
    );
  }

  return (
    <Center h="100vh" p="md">
      <Card withBorder shadow="sm" padding="xl" w={360} maw="100%">
        <form onSubmit={submit}>
          <Stack>
            <Stack align="center" gap={4}>
              <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 84, width: "auto", maxWidth: "100%" }} />
              <Text size="sm" c="dimmed">Portal sign in</Text>
            </Stack>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              autoFocus
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}
            <Button type="submit" loading={busy} fullWidth>
              Sign in
            </Button>
            <Anchor size="sm" ta="center" onClick={() => { setMode("reset"); setError(null); }}>
              Forgot your password?
            </Anchor>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
