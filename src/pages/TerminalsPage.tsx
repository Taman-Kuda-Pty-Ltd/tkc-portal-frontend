import { Stack, Text, Title } from "@mantine/core";
import { useAuth } from "../auth/AuthContext";
import { TerminalsSection } from "../components/TerminalsSection";

export function TerminalsPage() {
  const { can } = useAuth();
  return (
    <Stack maw={760} w="100%" mx="auto">
      <Title order={2}>Terminals</Title>
      {can("manage_settings") ? (
        <TerminalsSection />
      ) : (
        <Text c="dimmed">You don't have access to terminals.</Text>
      )}
    </Stack>
  );
}
