import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  PasswordInput,
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
  staff_type: StaffType;
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
  staff_type: "employee",
  employment_basis: "",
  position_title: "",
  start_date: null,
  role_ids: [],
};

export function PeoplePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canInvite = can("manage_onboarding");

  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [inviting, setInviting] = useState(false);
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

  const roleOptions = (rolesQ.data ?? []).map((r) => ({ value: String(r.id), label: r.name }));
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
        staff_type: invite.staff_type,
        employment_basis:
          invite.staff_type === "employee" && invite.employment_basis
            ? invite.employment_basis
            : null,
        position_title: invite.position_title || null,
        start_date: invite.start_date ? dayjs(invite.start_date).format("YYYY-MM-DD") : null,
        role_ids: invite.role_ids.map(Number),
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
    if (!p.onboarded) return <Badge color="yellow" variant="light">Invited</Badge>;
    return <Badge color="teal" variant="light">Active</Badge>;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>People</Title>
        <Group gap="xs">
          {canInvite && (
            <Button onClick={() => { setDupPerson(null); setInviting(true); }}>Invite</Button>
          )}
          <Button variant="default" onClick={() => { setDupPerson(null); setCreating(true); }}>
            Add manually
          </Button>
        </Group>
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
              {(peopleQ.data ?? []).map((p) => {
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
          <Text size="sm" c="dimmed">
            They'll get an email with a link to complete their own onboarding
            (personal, tax, super and bank details) and set a password.
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
              required
            />
            <PhoneField
              label="Mobile"
              value={invite.mobile}
              onChange={(v) => setInvite({ ...invite, mobile: v })}
            />
            <Select
              label="Type"
              data={STAFF_TYPES}
              value={invite.staff_type}
              onChange={(v) => setInvite({ ...invite, staff_type: (v as StaffType) ?? "employee" })}
              allowDeselect={false}
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
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Type, basis, position and start date are set here and shown (read-only) during onboarding.
          </Text>
          <MultiSelect
            label="Roles"
            data={roleOptions}
            value={invite.role_ids}
            onChange={(v) => setInvite({ ...invite, role_ids: v })}
            searchable
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => { setInviting(false); setDupPerson(null); }}
            >
              Cancel
            </Button>
            <Button
              loading={inviteM.isPending}
              disabled={!invite.given_name || !invite.family_name || !invite.email}
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
            disabled={!draft.given_name || !draft.family_name}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
