import { Stack, Text, Title } from "@mantine/core";
import { ResourceListSection } from "../components/ResourceListSection";

export function HorsesPage() {
  return (
    <Stack gap="md" maw={720} w="100%" mx="auto">
      <Title order={2}>Horses</Title>
      <Text size="sm" c="dimmed">
        The horses at the club. Basic details for now — name and whether they're active.
        This will grow into full horse records (agistees, owners, health, etc.).
      </Text>
      <ResourceListSection path="horses" addPlaceholder="Add a horse…" />
    </Stack>
  );
}
