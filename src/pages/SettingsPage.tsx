import { Accordion, Divider, Group, NumberInput, SegmentedControl, Stack, Text, Title, useMantineColorScheme } from "@mantine/core";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";
import { EmailSettingsSection } from "../components/EmailSettingsSection";
import { IntegrationsSection } from "../components/IntegrationsSection";
import { OrgSettingsSection } from "../components/OrgSettingsSection";
import { FacilitiesSection } from "../components/FacilitiesSection";
import { ActivitiesPage } from "./ActivitiesPage";
import { LensesPage } from "./LensesPage";
import { RolesPage } from "./RolesPage";

export function SettingsPage() {
  const { can } = useAuth();
  const { timeFormat, setTimeFormat, dateFormat, setDateFormat, workDayStart, workDayEnd, setWorkDay } =
    useSettings();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Stack gap="md" maw={1080} w="100%" mx="auto">
      <Title order={2}>Settings</Title>

      <Accordion multiple defaultValue={["preferences"]} variant="separated">
        {/* Preferences — available to everyone */}
        <Accordion.Item value="preferences">
          <Accordion.Control>
            <Text fw={600}>Preferences</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Saved on this device.
              </Text>
              <Group align="flex-start" gap={48} wrap="wrap">
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    Appearance
                  </Text>
                  <SegmentedControl
                    value={colorScheme}
                    onChange={(v) => setColorScheme(v as "light" | "dark" | "auto")}
                    data={[
                      { label: "Light", value: "light" },
                      { label: "Dark", value: "dark" },
                      { label: "Auto", value: "auto" },
                    ]}
                  />
                </div>
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
                    Date format
                  </Text>
                  <SegmentedControl
                    value={dateFormat}
                    onChange={(v) => setDateFormat(v as "DD/MM/YYYY" | "MM/DD/YYYY")}
                    data={[
                      { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
                      { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
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
                      styles={{ input: { textAlign: "right" } }}
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
                      styles={{ input: { textAlign: "right" } }}
                    />
                    <Text size="xs" c="dimmed">
                      (shaded on the time view)
                    </Text>
                  </Group>
                </div>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {can("manage_activities") && (
          <Accordion.Item value="activities">
            <Accordion.Control>
              <Text fw={600}>Activities</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <ActivitiesPage />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {can("manage_activities") && (
          <Accordion.Item value="facilities">
            <Accordion.Control>
              <Text fw={600}>Facilities</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <FacilitiesSection />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {/* Horses moved to their own nav item; students & account holders live in People. */}

        {can("manage_schedule_lenses") && (
          <Accordion.Item value="lenses">
            <Accordion.Control>
              <Text fw={600}>Lenses</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <LensesPage />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {can("manage_roles") && (
          <Accordion.Item value="roles">
            <Accordion.Control>
              <Text fw={600}>Roles</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <RolesPage />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {can("manage_settings") && (
          <Accordion.Item value="timekeeping">
            <Accordion.Control>
              <Text fw={600}>Timekeeping</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <OrgSettingsSection />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {can("manage_settings") && (
          <Accordion.Item value="integrations">
            <Accordion.Control>
              <Text fw={600}>Integrations</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <EmailSettingsSection />
              <Divider my="lg" />
              <IntegrationsSection />
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>
    </Stack>
  );
}
