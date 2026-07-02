import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCalendar, IconLogout, IconTemplate } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/schedule", label: "Schedule", icon: IconCalendar, cap: "view_schedule" },
  { to: "/templates", label: "Templates", icon: IconTemplate, cap: "view_schedule" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { me, logout, can } = useAuth();
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
          <Text size="sm" c="dimmed" visibleFrom="xs">
            {me?.full_name}
          </Text>
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
