import {
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <Center h="100vh" p="md">
      <Card withBorder shadow="sm" padding="xl" w={360} maw="100%">
        <form onSubmit={submit}>
          <Stack>
            <div>
              <Title order={3}>Taman Kuda Club</Title>
              <Text size="sm" c="dimmed">
                Staff sign in
              </Text>
            </div>
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
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
