import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { useSettings } from "../settings/SettingsContext";
import {
  IconCalendar,
  IconLogout,
  IconTemplate,
  IconTag,
  IconStack2,
  IconUsers,
  IconShieldLock,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/schedule", label: "Schedule", icon: IconCalendar, cap: "view_schedule" },
  { to: "/templates", label: "Templates", icon: IconTemplate, cap: "view_schedule" },
  { to: "/activities", label: "Activities", icon: IconTag, cap: "manage_activities" },
  { to: "/lenses", label: "Lenses", icon: IconStack2, cap: "manage_schedule_lenses" },
  { to: "/people", label: "People", icon: IconUsers, cap: "manage_people" },
  { to: "/roles", label: "Roles", icon: IconShieldLock, cap: "manage_roles" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { me, logout, can } = useAuth();
  const { timeFormat, setTimeFormat } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>Taman Kuda Club</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed" visibleFrom="xs">
              {me?.full_name}
            </Text>
            <Menu shadow="md" width={220} position="bottom-end" closeOnItemClick={false}>
              <Menu.Target>
                <ActionIcon variant="subtle" aria-label="Settings">
                  <IconSettings size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Settings</Menu.Label>
                <Stack gap={4} px="sm" py="xs">
                  <Text size="xs" c="dimmed">
                    Time format
                  </Text>
                  <SegmentedControl
                    size="xs"
                    fullWidth
                    value={timeFormat}
                    onChange={(v) => setTimeFormat(v as "12h" | "24h")}
                    data={[
                      { label: "12-hour", value: "12h" },
                      { label: "24-hour", value: "24h" },
                    ]}
                  />
                </Stack>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          {NAV.filter((n) => can(n.cap)).map((n) => (
            <NavLink
              key={n.to}
              component={RouterNavLink}
              to={n.to}
              label={n.label}
              leftSection={<n.icon size={18} />}
              active={location.pathname.startsWith(n.to)}
              onClick={close}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <UnstyledButton
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <Group gap="xs" c="dimmed">
              <IconLogout size={18} />
              <Text size="sm">Sign out</Text>
            </Group>
          </UnstyledButton>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
