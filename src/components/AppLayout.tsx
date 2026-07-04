import { AppShell, Badge, Burger, Group, NavLink, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  IconCalendar,
  IconChecklist,
  IconLogout,
  IconSettings,
  IconTemplate,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/schedule", label: "Schedule", icon: IconCalendar, cap: "view_schedule" },
  { to: "/people", label: "People", icon: IconUsers, cap: "manage_people" },
  { to: "/templates", label: "Templates", icon: IconTemplate, cap: "view_schedule" },
  { to: "/approvals", label: "Approvals", icon: IconChecklist, cap: "manage_shifts" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { me, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingQ = useQuery({
    queryKey: ["pending-approval-count"],
    queryFn: () => api.get<number>("/shifts/pending-approval/count"),
    enabled: can("manage_shifts"),
    refetchInterval: 30000,
  });

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
              rightSection={
                n.to === "/approvals" && (pendingQ.data ?? 0) > 0 ? (
                  <Badge size="sm" color="red" variant="filled">{pendingQ.data}</Badge>
                ) : undefined
              }
              active={location.pathname.startsWith(n.to)}
              onClick={close}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Stack gap="sm">
            <UnstyledButton
              onClick={() => {
                navigate("/settings");
                close();
              }}
            >
              <Group gap="xs" c={location.pathname.startsWith("/settings") ? undefined : "dimmed"}>
                <IconSettings size={18} />
                <Text size="sm">Settings</Text>
              </Group>
            </UnstyledButton>
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
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
