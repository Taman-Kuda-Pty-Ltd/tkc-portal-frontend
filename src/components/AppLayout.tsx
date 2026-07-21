import { AppShell, Avatar, Badge, Burger, Button, Card, Center, Group, Menu, NavLink, ScrollArea, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import tkcLogo from "../assets/tkc-logo-wide.png";
import {
  IconCalendar,
  IconChecklist,
  IconCoin,
  IconDeviceDesktop,
  IconHorse,
  IconLogout,
  IconSettings,
  IconTemplate,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { terminalOnline } from "./TerminalsSection";

function initials(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
import type { ReactNode } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/schedule", label: "Schedule", icon: IconCalendar, cap: "view_schedule" },
  { to: "/people", label: "People", icon: IconUsers, cap: "manage_people" },
  { to: "/horses", label: "Horses", icon: IconHorse, cap: "manage_activities" },
  { to: "/templates", label: "Templates", icon: IconTemplate, cap: "view_schedule" },
  { to: "/approvals", label: "Approvals", icon: IconChecklist, cap: "manage_shifts" },
  { to: "/payroll", label: "Payroll", icon: IconCoin, cap: "manage_shifts" },
  { to: "/terminals", label: "Terminals", icon: IconDeviceDesktop, cap: "manage_settings" },
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
  const coachChangesQ = useQuery({
    queryKey: ["coach-changes-count"],
    queryFn: () => api.get<number>("/coach-changes/pending/count"),
    enabled: can("manage_shifts"),
    refetchInterval: 30000,
  });
  const varianceQ = useQuery({
    queryKey: ["variance-count"],
    queryFn: () => api.get<number>("/variance/pending/count"),
    enabled: can("manage_shifts"),
    refetchInterval: 30000,
  });
  const lessonTypeQ = useQuery({
    queryKey: ["lesson-type-changes-count"],
    queryFn: () => api.get<number>("/lesson-type-changes/pending/count"),
    enabled: can("manage_shifts"),
    refetchInterval: 30000,
  });
  // Heads-up signals that weren't counted before (E): no-shows, still-checked-in,
  // unrated staff (PR-4), un-onboarded assignees (PO-10).
  const attn = { enabled: can("manage_shifts"), refetchInterval: 30000 };
  const noShowQ = useQuery({ queryKey: ["no-shows-count"], queryFn: () => api.get<number>("/shifts/no-shows/count"), ...attn });
  const openQ = useQuery({ queryKey: ["open-att-count"], queryFn: () => api.get<number>("/attendance/open/count"), ...attn });
  const unratedQ = useQuery({ queryKey: ["unrated-count"], queryFn: () => api.get<number>("/reports/unrated-staff/count"), ...attn });
  const unonbQ = useQuery({ queryKey: ["unonboarded-count"], queryFn: () => api.get<number>("/shifts/unonboarded-assignees/count"), ...attn });
  const flaggedQ = useQuery({ queryKey: ["flagged-notes-count"], queryFn: () => api.get<number>("/coach-notes/flagged/count"), ...attn });
  // HB-3: horses whose worming is due soon / overdue — an attention (heads-up) signal.
  const careDueQ = useQuery({ queryKey: ["horse-care-due-count"], queryFn: () => api.get<number>("/horses/care-due/count"), ...attn });
  // SC-4: staff-initiated shift covers awaiting a manager's after-the-fact acknowledgement.
  const coversQ = useQuery({ queryKey: ["shift-covers-count"], queryFn: () => api.get<number>("/shift-covers/pending/count"), ...attn });
  // WAIVER-VERSIONING: students without a valid signature of the current waiver version.
  const waiverQ = useQuery({ queryKey: ["waiver-pending-count"], queryFn: () => api.get<number>("/waivers/pending-signatures/count"), enabled: can("manage_people"), refetchInterval: 30000 });
  // MINOR-STAFF-CONSENT: scheduled minor workers without confirmed guardian consent.
  const minorQ = useQuery({ queryKey: ["minor-consent-count"], queryFn: () => api.get<number>("/people/minor-staff-consent/pending/count"), enabled: can("manage_people"), refetchInterval: 30000 });
  // CRED-ATTENTION: workers missing/unverified for a required credential.
  const credQ = useQuery({ queryKey: ["cred-attention-count"], queryFn: () => api.get<number>("/people/credential-attention/pending/count"), enabled: can("manage_people"), refetchInterval: 30000 });
  // APPR-1: split the single nav count into two badges matching the Approvals &
  // attention bands — red = approvals (needs a decision/action), amber = attention
  // (heads-up). Flagged notes sit in the "Needs action" band, so count as approvals.
  const approvalsCount =
    (pendingQ.data ?? 0) + (coachChangesQ.data ?? 0) + (varianceQ.data ?? 0) +
    (lessonTypeQ.data ?? 0) + (flaggedQ.data ?? 0);
  const attentionCount =
    (noShowQ.data ?? 0) + (openQ.data ?? 0) + (unratedQ.data ?? 0) + (unonbQ.data ?? 0) +
    (careDueQ.data ?? 0) + (coversQ.data ?? 0) + (waiverQ.data ?? 0) + (minorQ.data ?? 0) +
    (credQ.data ?? 0);

  // FH-3: badge the Terminals nav with devices that opted into offline alerts and
  // haven't checked in recently.
  const terminalsQ = useQuery({
    queryKey: ["terminals"],
    queryFn: () => api.get<{ is_active: boolean; alert_when_offline: boolean; last_seen_at: string | null }[]>("/terminals"),
    enabled: can("manage_settings"),
    refetchInterval: 60000,
  });
  const terminalsOffline = (terminalsQ.data ?? []).filter(
    (t) => t.is_active && t.alert_when_offline && !terminalOnline(t),
  ).length;
  // Badges per nav item: Approvals shows two (approvals + attention), Terminals one.
  const navBadges = (to: string): { count: number; color: string }[] => {
    if (to === "/approvals")
      return [
        { count: approvalsCount, color: "red" },
        { count: attentionCount, color: "yellow" },
      ].filter((b) => b.count > 0);
    if (to === "/terminals" && terminalsOffline > 0)
      return [{ count: terminalsOffline, color: "orange" }];
    return [];
  };

  // Someone with no staff capabilities (e.g. a school client) has nowhere to go in
  // the staff app yet — show a friendly screen instead of empty/broken pages.
  const hasStaffAccess = NAV.some((n) => can(n.cap)) || can("manage_settings");
  if (!hasStaffAccess) {
    return (
      <Center h="100vh" p="md">
        <Card withBorder maw={440} p="xl">
          <Stack>
            <Title order={3}>You're signed in</Title>
            <Text>
              Hi {me?.full_name} — your account doesn't have access to the staff app.
              A member area for clients is coming soon.
            </Text>
            <Button variant="light" onClick={logout}>Sign out</Button>
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <img src={tkcLogo} alt="Taman Kuda Club" style={{ height: 40, width: "auto" }} />
          </Group>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  {/* AVATAR-COLOR: Malaysian-flag blue (royal), not the off-theme green. */}
                  <Avatar radius="xl" size="sm" color="royal">{initials(me?.full_name)}</Avatar>
                  <Text size="sm" c="dimmed" visibleFrom="xs">{me?.full_name}</Text>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUser size={16} />}
                onClick={() => { navigate("/me"); close(); }}>My profile</Menu.Item>
              <Menu.Item leftSection={<IconCoin size={16} />}
                onClick={() => { navigate("/me/pay"); close(); }}>My pay</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={16} />}
                onClick={() => { logout(); navigate("/login"); }}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
                navBadges(n.to).length > 0 ? (
                  <Group gap={4} wrap="nowrap">
                    {navBadges(n.to).map((b) => (
                      <Badge key={b.color} size="sm" color={b.color} variant="filled">
                        {b.count}
                      </Badge>
                    ))}
                  </Group>
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
