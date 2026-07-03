import { Divider, Group, NumberInput, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";
import { ActivitiesPage } from "./ActivitiesPage";
import { LensesPage } from "./LensesPage";

export function SettingsPage() {
  const { can } = useAuth();
  const { timeFormat, setTimeFormat, workDayStart, workDayEnd, setWorkDay } = useSettings();

  return (
    <Stack gap="xl">
      <Title order={2}>Settings</Title>

      {/* Preferences — available to everyone */}
      <Stack gap="sm">
        <Title order={3}>Preferences</Title>
        <Text size="sm" c="dimmed">
          Saved on this device.
        </Text>
        <Group align="flex-start" gap={48} wrap="wrap">
          <div>
            <Text size="sm" fw={500} mb={4}>
              Time display
            </Text>
            <SegmentedControl
              value={timeFormat}
              onChange={(v) => setTimeFormat(v as "12h" | "24h")}
              data={[
                { label: "12-hour", value: "12h" },
                { label: "24-hour", value: "24h" },
              ]}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={4}>
              Work day
            </Text>
            <Group gap={8} align="center">
              <NumberInput
                w={80}
                aria-label="Work day start hour"
                min={0}
                max={23}
                value={workDayStart}
                onChange={(v) => setWorkDay(Number(v) || 0, workDayEnd)}
              />
              <Text size="sm" c="dimmed">
                to
              </Text>
              <NumberInput
                w={80}
                aria-label="Work day end hour"
                min={1}
                max={24}
                value={workDayEnd}
                onChange={(v) => setWorkDay(workDayStart, Number(v) || 24)}
              />
              <Text size="xs" c="dimmed">
                (shaded on the time view)
              </Text>
            </Group>
          </div>
        </Group>
      </Stack>

      {can("manage_activities") && (
        <>
          <Divider />
          <ActivitiesPage />
        </>
      )}

      {can("manage_schedule_lenses") && (
        <>
          <Divider />
          <LensesPage />
        </>
      )}
    </Stack>
  );
}
