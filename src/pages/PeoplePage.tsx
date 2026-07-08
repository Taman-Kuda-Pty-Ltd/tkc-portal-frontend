import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Pagination,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { EmploymentBasis, Invitation, Person, Role, StaffType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { PhoneField } from "../components/PhoneField";
import { StudentRegisterModal } from "../components/StudentRegisterModal";

interface ReDraft {
  staff_type: StaffType;
  employment_basis: EmploymentBasis | "";
  position_title: string;
  start_date: Date | null;
  role_ids: string[];
}

const STAFF_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
];

interface Draft {
  given_name: string;
  middle_names: string;
  family_name: string;
  preferred_name: string;
  email: string;
  mobile: string;
  password: string;
  is_active: boolean;
  role_ids: string[];
}

const EMPTY: Draft = {
  given_name: "",
  middle_names: "",
  family_name: "",
  preferred_name: "",
  email: "",
  mobile: "",
  password: "",
  is_active: true,
  role_ids: [],
};

interface InviteDraft {
  given_name: string;
  family_name: string;
  email: string;
  mobile: string;
  kind: "staff" | "school_client";
  staff_type: StaffType;
  work_role_id: string | null;
  employment_basis: EmploymentBasis | "";
  position_title: string;
  start_date: Date | null;
  role_ids: string[];
}

const EMPTY_INVITE: InviteDraft = {
  given_name: "",
  family_name: "",
  email: "",
  mobile: "",
  kind: "staff",
  staff_type: "employee",
  work_role_id: null,
  employment_basis: "",
  position_title: "",
  start_date: null,
  role_ids: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailError = (v: string) => (v.trim() && !EMAIL_RE.test(v.trim()) ? "Enter a valid email address" : null);

export function PeoplePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canInvite = can("manage_onboarding");

  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [inviting, setInviting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [invite, setInvite] = useState<InviteDraft>(EMPTY_INVITE);
  const [reonboarding, setReonboarding] = useState<Person | null>(null);
  const [reDraft, setReDraft] = useState<ReDraft>({
    staff_type: "employee",
    employment_basis: "",
    position_title: "",
    start_date: null,
    role_ids: [],
  });
  const [dupPerson, setDupPerson] = useState<Person | null>(null);

  const peopleQ = useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/people") });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => api.get<Role[]>("/roles") });
  const invitesQ = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.get<Invitation[]>("/invitations"),
    enabled: canInvite,
  });

  const pendingByPerson = useMemo(() => {
    const m = new Map<number, Invitation>();
    for (const i of invitesQ.data ?? []) if (i.status === "pending") m.set(i.person_id, i);
    return m;
  }, [invitesQ.data]);

  useEffect(() => {
    if (editing)
      setDraft({
        given_name: editing.given_name,
        middle_names: editing.middle_names ?? "",
        family_name: editing.family_name,
        preferred_name: editing.preferred_name ?? "",
        email: editing.email ?? "",
        mobile: editing.mobile ?? "",
        password: "",
        is_active: editing.is_active,
        role_ids: editing.roles.map((r) => String(r.id)),
      });
    else if (creating) setDraft(EMPTY);
  }, [editing, creating]);

  useEffect(() => {
    if (inviting) setInvite(EMPTY_INVITE);
  }, [inviting]);

  const roleOptions = (rolesQ.data ?? [])
    .filter((r) => r.is_selectable !== false)
    .map((r) => ({ value: String(r.id), label: r.name }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["invitations"] });
  };

  // On a duplicate-email 409, point at the existing person instead of a raw error.
  function dupError(e: unknown, email: string): boolean {
    if (e instanceof ApiError && e.status === 409) {
      const p = (peopleQ.data ?? []).find(
        (pp) => (pp.email ?? "").toLowerCase() === email.trim().toLowerCase(),
      );
      if (p) {
        setDupPerson(p);
        return true;
      }
    }
    return false;
  }

  const saveM = useMutation({
    mutationFn: () => {
      const roleIds = draft.role_ids.map(Number);
      const core = {
        given_name: draft.given_name,
        middle_names: draft.middle_names || null,
        family_name: draft.family_name,
        preferred_name: draft.preferred_name || null,
        email: draft.email || null,
        mobile: draft.mobile || null,
        role_ids: roleIds,
      };
      if (editing) {
        const body: Record<string, unknown> = { ...core, is_active: draft.is_active };
        if (draft.password) body.password = draft.password;
        return api.patch(`/people/${editing.id}`, body);
      }
      return api.post("/people", { ...core, password: draft.password || null });
    },
    onSuccess: () => {
      refresh();
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => {
      if (!(creating && dupError(e, draft.email))) {
        notifications.show({ color: "red", message: e.message });
      }
    },
  });

  const inviteM = useMutation({
    mutationFn: () =>
      api.post<Invitation>("/invitations", {
        given_name: invite.given_name,
        family_name: invite.family_name,
        email: invite.email,
        mobile: invite.mobile || null,
        kind: invite.kind,
        staff_type: invite.staff_type,
        work_role_id: invite.kind === "staff" && invite.work_role_id ? Number(invite.work_role_id) : null,
        employment_basis:
          invite.kind === "staff" && invite.staff_type === "employee" && invite.employment_basis
            ? invite.employment_basis
            : null,
        position_title: invite.kind === "staff" ? invite.position_title || null : null,
        start_date:
          invite.kind === "staff" && invite.start_date
            ? dayjs(invite.start_date).format("YYYY-MM-DD")
            : null,
        role_ids: invite.kind === "staff" ? invite.role_ids.map(Number) : [],
      }),
    onSuccess: (inv) => {
      refresh();
      setInviting(false);
      if (inv.email_sent) {
        notifications.show({ color: "teal", message: `Invitation emailed to ${inv.email}.` });
      } else {
        notifications.show({
          color: "yellow",
          autoClose: 9000,
          message: `Invite created but email failed: ${inv.email_error ?? "check Settings → Email"}. You can resend later.`,
        });
      }
    },
    onError: (e: Error) => {
      if (!dupError(e, invite.email)) notifications.show({ color: "red", message: e.message });
    },
  });

  const reonboardM = useMutation({
    mutationFn: () =>
      api.post<Invitation>("/invitations/reonboard", {
        person_id: reonboarding!.id,
        staff_type: reDraft.staff_type,
        employment_basis:
          reDraft.staff_type === "employee" && reDraft.employment_basis
            ? reDraft.employment_basis
            : null,
        position_title: reDraft.position_title || null,
        start_date: reDraft.start_date ? dayjs(reDraft.start_date).format("YYYY-MM-DD") : null,
        role_ids: reDraft.role_ids.map(Number),
      }),
    onSuccess: (inv) => {
      refresh();
      setReonboarding(null);
      notifications.show({
        color: inv.email_sent ? "teal" : "yellow",
        message: inv.email_sent
          ? `Re-onboarding link emailed to ${inv.email}.`
          : `Created but email failed: ${inv.email_error}. Resend from the row.`,
      });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

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

  const editOpen = editing !== null || creating;

  const dupAlert = dupPerson && (
    <Alert color="yellow" title="Email already in use">
      <Text size="sm">{dupPerson.full_name} already uses that email address.</Text>
      <Button
        size="xs"
        variant="light"
        mt="xs"
        onClick={() => {
          const p = dupPerson;
          setDupPerson(null);
          setInviting(false);
          setCreating(false);
          setEditing(p);
        }}
      >
        Open {dupPerson.full_name}'s profile
      </Button>
    </Alert>
  );

  function statusBadge(p: Person) {
    if (!p.is_active) return <Badge color="gray" variant="light">Disabled</Badge>;
    // A client (rider / account holder) with no staff login isn't "Invited" — that's a
    // pending staff invite. Show them as Registered instead.
    if (!p.onboarded && (p.is_student || p.is_account_holder) && p.roles.length === 0)
      return <Badge color="grape" variant="light">Registered</Badge>;
    if (!p.onboarded) return <Badge color="yellow" variant="light">Invited</Badge>;
    return <Badge color="teal" variant="light">Active</Badge>;
  }

  // --- list search / filter / paging (client-side; the roster is small) ---
  const PAGE_SIZE = 25;
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "staff" | "student" | "account_holder">("all");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (peopleQ.data ?? []).filter((p) => {
      if (q && !`${p.full_name} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (kind === "student" && !p.is_student) return false;
      if (kind === "account_holder" && !p.is_account_holder) return false;
      // "Staff" = not a pure client (has a role, or isn't a student/account holder).
      if (kind === "staff" && (p.is_student || p.is_account_holder) && p.roles.length === 0)
        return false;
      if (roleFilter && !p.roles.some((r) => String(r.id) === roleFilter)) return false;
      return true;
    });
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
        <Group gap="xs">
          {canInvite && (
            <Button onClick={() => { setDupPerson(null); setInviting(true); }}>Invite</Button>
          )}
          <Button variant="light" onClick={() => setRegistering(true)}>Register student</Button>
          <Button variant="default" onClick={() => { setDupPerson(null); setCreating(true); }}>
            Add manually
          </Button>
        </Group>
      </Group>

      <StudentRegisterModal opened={registering} onClose={() => setRegistering(false)} />

      <Group gap="sm" wrap="wrap" align="flex-end">
        <TextInput
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={240}
        />
        <SegmentedControl
          size="xs"
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          data={[
            { label: "All", value: "all" },
            { label: "Staff", value: "staff" },
            { label: "Students", value: "student" },
            { label: "Account holders", value: "account_holder" },
          ]}
        />
        <Select
          placeholder="Any role"
          size="xs"
          w={150}
          clearable
          data={roleOptions}
          value={roleFilter}
          onChange={setRoleFilter}
          comboboxProps={{ withinPortal: true }}
        />
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
                      <Anchor onClick={() => navigate(`/people/${p.id}`)}>{p.full_name}</Anchor>
                    </Table.Td>
                    <Table.Td>{p.email ?? <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {p.roles.map((r) => (
                          <Badge key={r.id} size="sm" variant="light">
                            {r.name}
                          </Badge>
                        ))}
                        {p.is_student && <Badge size="sm" variant="light" color="grape">Student</Badge>}
                        {p.is_account_holder && <Badge size="sm" variant="light" color="cyan">Account holder</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{statusBadge(p)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {pending && (
                          <>
                            <Button
                              size="xs"
                              variant="subtle"
                              loading={resendM.isPending}
                              onClick={() => resendM.mutate(pending.id)}
                            >
                              Resend
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => revokeM.mutate(pending.id)}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                        {p.onboarded && canInvite && (
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => {
                              setReDraft({
                                staff_type: "employee",
                                employment_basis: "",
                                position_title: "",
                                start_date: null,
                                role_ids: p.roles.map((r) => String(r.id)),
                              });
                              setReonboarding(p);
                            }}
                          >
                            Re-onboard
                          </Button>
                        )}
                        <Button size="xs" variant="subtle" onClick={() => setEditing(p)}>
                          Edit
                        </Button>
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

      {/* Invite modal */}
      <Modal
        opened={inviting}
        onClose={() => { setInviting(false); setDupPerson(null); }}
        title="Invite a person"
        size="lg"
        closeOnClickOutside={false}
      >
        <Stack>
          {dupAlert}
          <SegmentedControl
            fullWidth
            value={invite.kind}
            onChange={(v) => setInvite({ ...invite, kind: v as InviteDraft["kind"] })}
            data={[
              { value: "staff", label: "Staff" },
              { value: "school_client", label: "School client" },
            ]}
          />
          <Text size="sm" c="dimmed">
            {invite.kind === "staff"
              ? "They'll get an email link to complete their onboarding (personal, tax, super and bank details) and set a password."
              : "They'll get an email link to set up their account and add their riders (students) — no financial details."}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Given name"
              value={invite.given_name}
              onChange={(e) => setInvite({ ...invite, given_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Family name"
              value={invite.family_name}
              onChange={(e) => setInvite({ ...invite, family_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Email"
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.currentTarget.value })}
              error={emailError(invite.email)}
              required
            />
            <PhoneField
              label="Mobile"
              value={invite.mobile}
              onChange={(v) => setInvite({ ...invite, mobile: v })}
            />
            {invite.kind === "staff" && (
              <>
                <Select
                  label="Type"
                  data={STAFF_TYPES}
                  value={invite.staff_type}
                  onChange={(v) => setInvite({ ...invite, staff_type: (v as StaffType) ?? "employee" })}
                  allowDeselect={false}
                />
                <Select
                  label="Work role"
                  placeholder="e.g. Groom, Stablehand, Coach"
                  data={roleOptions}
                  value={invite.work_role_id}
                  onChange={(v) => setInvite({ ...invite, work_role_id: v })}
                  searchable
                />
                {invite.staff_type === "employee" && (
                  <Select
                    label="Employment basis"
                    data={[
                      { value: "full_time", label: "Full-time" },
                      { value: "part_time", label: "Part-time" },
                      { value: "casual", label: "Casual" },
                    ]}
                    value={invite.employment_basis || null}
                    onChange={(v) => setInvite({ ...invite, employment_basis: (v as EmploymentBasis) || "" })}
                  />
                )}
                <TextInput
                  label="Position / title"
                  value={invite.position_title}
                  onChange={(e) => setInvite({ ...invite, position_title: e.currentTarget.value })}
                />
                <DateField
                  label="Start date"
                  value={invite.start_date}
                  onChange={(d) => setInvite({ ...invite, start_date: d })}
                />
              </>
            )}
          </SimpleGrid>
          {invite.kind === "staff" && (
            <MultiSelect
              label="Roles"
              data={roleOptions}
              value={invite.role_ids}
              onChange={(v) => setInvite({ ...invite, role_ids: v })}
              searchable
            />
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => { setInviting(false); setDupPerson(null); }}
            >
              Cancel
            </Button>
            <Button
              loading={inviteM.isPending}
              disabled={!invite.given_name || !invite.family_name || !invite.email || !!emailError(invite.email)}
              onClick={() => inviteM.mutate()}
            >
              Send invitation
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Re-onboard modal */}
      <Modal
        opened={reonboarding !== null}
        onClose={() => setReonboarding(null)}
        title={`Re-onboard ${reonboarding?.full_name ?? ""}`}
        size="lg"
        closeOnClickOutside={false}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Set the new engagement, then send {reonboarding?.given_name} a pre-filled
            onboarding link to add the extra details. Same person and login — they
            keep their current password.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Type"
              data={STAFF_TYPES}
              value={reDraft.staff_type}
              onChange={(v) => setReDraft({ ...reDraft, staff_type: (v as StaffType) ?? "employee" })}
              allowDeselect={false}
            />
            {reDraft.staff_type === "employee" && (
              <Select
                label="Employment basis"
                data={[
                  { value: "full_time", label: "Full-time" },
                  { value: "part_time", label: "Part-time" },
                  { value: "casual", label: "Casual" },
                ]}
                value={reDraft.employment_basis || null}
                onChange={(v) => setReDraft({ ...reDraft, employment_basis: (v as EmploymentBasis) || "" })}
              />
            )}
            <TextInput
              label="Position / title"
              value={reDraft.position_title}
              onChange={(e) => setReDraft({ ...reDraft, position_title: e.currentTarget.value })}
            />
            <DateField
              label="Start date"
              value={reDraft.start_date}
              onChange={(d) => setReDraft({ ...reDraft, start_date: d })}
            />
          </SimpleGrid>
          <MultiSelect
            label="Roles"
            data={roleOptions}
            value={reDraft.role_ids}
            onChange={(v) => setReDraft({ ...reDraft, role_ids: v })}
            searchable
          />
          <Button loading={reonboardM.isPending} onClick={() => reonboardM.mutate()}>
            Send re-onboarding link
          </Button>
        </Stack>
      </Modal>

      {/* Add / edit modal */}
      <Modal
        opened={editOpen}
        onClose={() => {
          setEditing(null);
          setCreating(false);
          setDupPerson(null);
        }}
        title={editing ? `Edit ${editing.full_name}` : "Add person"}
        size="lg"
        closeOnClickOutside={false}
      >
        <Stack>
          {dupAlert}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Given name"
              value={draft.given_name}
              onChange={(e) => setDraft({ ...draft, given_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Family name"
              value={draft.family_name}
              onChange={(e) => setDraft({ ...draft, family_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Middle name/s"
              value={draft.middle_names}
              onChange={(e) => setDraft({ ...draft, middle_names: e.currentTarget.value })}
            />
            <TextInput
              label="Preferred name"
              placeholder="Shown on the schedule"
              value={draft.preferred_name}
              onChange={(e) => setDraft({ ...draft, preferred_name: e.currentTarget.value })}
            />
            <TextInput
              label="Email"
              type="email"
              value={draft.email}
              disabled={!!editing}
              error={emailError(draft.email)}
              onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })}
            />
            <TextInput
              label="Mobile"
              value={draft.mobile}
              onChange={(e) => setDraft({ ...draft, mobile: e.currentTarget.value })}
            />
          </SimpleGrid>
          <MultiSelect
            label="Roles"
            data={roleOptions}
            value={draft.role_ids}
            onChange={(v) => setDraft({ ...draft, role_ids: v })}
            searchable
          />
          <PasswordInput
            label={editing ? "Reset password (optional)" : "Password (optional)"}
            description={!editing ? "Leave blank to onboard by invitation later." : undefined}
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.currentTarget.value })}
          />
          {editing && (
            <Switch
              label="Active"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.currentTarget.checked })}
            />
          )}
          <Button
            loading={saveM.isPending}
            disabled={!draft.given_name || !draft.family_name || !!emailError(draft.email)}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
