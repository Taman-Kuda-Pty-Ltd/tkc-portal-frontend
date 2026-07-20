import {
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { roleColor } from "../constants/roleColors";
import { isPureClient, personStatusBadge } from "../lib/personStatus";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Invitation, Person, Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 25;

export function PeoplePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canInvite = can("manage_onboarding");

  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const invitesQ = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.get<Invitation[]>("/invitations"),
    enabled: canInvite,
  });

  const pendingByPerson = useMemo(() => {
    const m = new Map<number, Invitation>();
    // Only a not-yet-onboarded STAFF/CLIENT invite means "Invited" + Resend/Revoke. A
    // pending SET_PASSWORD invite belongs to an already-onboarded person (they just
    // need to set a password) — that's surfaced on their profile, not here
    // (RESEND-REVOKE-SHOWN).
    for (const i of invitesQ.data ?? [])
      if (i.status === "pending" && i.kind !== "set_password") m.set(i.person_id, i);
    return m;
  }, [invitesQ.data]);

  const roleOptions = (rolesQ.data ?? [])
    .filter((r) => r.is_selectable !== false)
    .map((r) => ({ value: String(r.id), label: r.name }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["invitations"] });
  };

  const resendM = useMutation({
    mutationFn: (id: number) => api.post<Invitation>(`/invitations/${id}/resend`),
    onSuccess: (inv) => {
      refresh();
      notifications.show({
        color: inv.email_sent ? "teal" : "yellow",
        message: inv.email_sent ? "Invitation resent." : `Resend failed: ${inv.email_error}`,
      });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const revokeM = useMutation({
    mutationFn: (id: number) => api.post(`/invitations/${id}/revoke`),
    onSuccess: refresh,
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });


  // --- search / filter / paging (client-side; the roster is small) ---
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "staff" | "student" | "account_holder">("all");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (peopleQ.data ?? []).filter((p) => {
      if (query && !`${p.full_name} ${p.list_name} ${p.email ?? ""}`.toLowerCase().includes(query)) return false;
      if (kind === "student" && !p.is_student) return false;
      if (kind === "account_holder" && !p.is_account_holder) return false;
      if (kind === "staff" && isPureClient(p)) return false;
      if (roleFilter && !p.roles.some((r) => String(r.id) === roleFilter)) return false;
      return true;
    // Alphabetical by surname to match the "Family, Given" listing (NAME-LIST).
    }).sort((a, b) => a.list_name.localeCompare(b.list_name));
  }, [peopleQ.data, search, kind, roleFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / PAGE_SIZE));
  const pagedPeople = filteredPeople.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [search, kind, roleFilter]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>People</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate("/people/new")}>
          Add person
        </Button>
      </Group>

      <Group gap="sm" wrap="wrap" align="flex-end">
        <TextInput placeholder="Search name or email…" value={search} w={240}
          onChange={(e) => setSearch(e.currentTarget.value)} />
        <SegmentedControl size="xs" value={kind} onChange={(v) => setKind(v as typeof kind)}
          data={[
            { label: "All", value: "all" },
            { label: "Staff", value: "staff" },
            { label: "Students", value: "student" },
            { label: "Account holders", value: "account_holder" },
          ]} />
        <Select placeholder="Any role" size="xs" w={150} clearable data={roleOptions}
          value={roleFilter} onChange={setRoleFilter} comboboxProps={{ withinPortal: true }} />
      </Group>

      {peopleQ.isLoading ? (
        <Loader />
      ) : (
        <Table.ScrollContainer minWidth={620}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Roles</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pagedPeople.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" size="sm" py="sm">No people match your search.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {pagedPeople.map((p) => {
                const pending = pendingByPerson.get(p.id);
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Anchor onClick={() => navigate(`/people/${p.id}`)}>{p.list_name}</Anchor>
                    </Table.Td>
                    <Table.Td>{p.email ?? <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {p.roles.map((r) => (
                          <Badge key={r.id} size="sm" variant="light" color={roleColor(r.slug)}>{r.name}</Badge>
                        ))}
                        {p.is_student && <Badge size="sm" variant="light" color="grape">Student</Badge>}
                        {p.is_account_holder && <Badge size="sm" variant="light" color="cyan">Account holder</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{personStatusBadge(p)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {pending && canInvite && (
                          <>
                            {pending.onboarding_url && (
                              // LINK-REGEN: always let the manager re-copy the invite
                              // link (e.g. after dismissing the create screen), without
                              // having to recreate the engagement.
                              <Button size="xs" variant="subtle" onClick={() => {
                                navigator.clipboard.writeText(pending.onboarding_url!);
                                notifications.show({ color: "teal", message: "Onboarding link copied." });
                              }}>Copy link</Button>
                            )}
                            <Button size="xs" variant="subtle" loading={resendM.isPending}
                              onClick={() => resendM.mutate(pending.id)}>Resend</Button>
                            <Button size="xs" variant="subtle" color="red"
                              onClick={() => revokeM.mutate(pending.id)}>Revoke</Button>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {!peopleQ.isLoading && filteredPeople.length > 0 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredPeople.length)} of{" "}
            {filteredPeople.length}
          </Text>
          {pageCount > 1 && <Pagination value={page} onChange={setPage} total={pageCount} size="sm" />}
        </Group>
      )}
    </Stack>
  );
}
