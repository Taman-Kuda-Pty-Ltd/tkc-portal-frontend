import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { IconPlus, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PersonDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DateField } from "../components/DateField";
import { FileUpload, useStorageStatus } from "../components/FileUpload";
import { PhoneField } from "../components/PhoneField";

const TYPE_LABEL: Record<string, string> = {
  employee: "Employee", contractor: "Contractor", volunteer: "Volunteer", other: "Other",
};
function prettyCap(cap: string) {
  const s = cap.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface EcDraft { name: string; relationship: string; phone: string }

export function MyProfilePage() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const storageReady = useStorageStatus();
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => api.get<PersonDetail>("/me/profile") });
  const p = q.data;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    given_name: "", middle_names: "", family_name: "", preferred_name: "",
    dob: null as Date | null, mobile: "",
  });
  const [addr, setAddr] = useState({ line1: "", line2: "", suburb: "", state: "", postcode: "" });
  const [ecs, setEcs] = useState<EcDraft[]>([]);

  useEffect(() => {
    if (!p || editing) return;
    setDraft({
      given_name: p.given_name, middle_names: p.middle_names ?? "", family_name: p.family_name,
      preferred_name: p.preferred_name ?? "", dob: p.date_of_birth ? dayjs(p.date_of_birth).toDate() : null,
      mobile: p.mobile ?? "",
    });
    setAddr({
      line1: p.address?.line1 ?? "", line2: p.address?.line2 ?? "", suburb: p.address?.suburb ?? "",
      state: p.address?.state ?? "", postcode: p.address?.postcode ?? "",
    });
    setEcs(p.emergency_contacts.map((e) => ({
      name: e.name, relationship: e.relationship ?? "", phone: e.phone ?? "",
    })));
  }, [p, editing]);

  const saveM = useMutation({
    mutationFn: () =>
      api.patch("/me/profile", {
        given_name: draft.given_name, middle_names: draft.middle_names || null,
        family_name: draft.family_name, preferred_name: draft.preferred_name || null,
        mobile: draft.mobile || null,
        date_of_birth: draft.dob ? dayjs(draft.dob).format("YYYY-MM-DD") : null,
        address: addr,
        emergency_contacts: ecs.filter((e) => e.name.trim()),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      setEditing(false);
      notifications.show({ color: "teal", message: "Profile updated." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  if (q.isLoading || !p) return <Loader />;
  const ro = !editing;

  return (
    <Stack maw={720} w="100%" mx="auto">
      <Group justify="space-between">
        <Title order={2}>My profile</Title>
        {editing ? (
          <Group gap="xs">
            <Button variant="default" onClick={() => setEditing(false)}>Cancel</Button>
            <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
          </Group>
        ) : (
          <Button variant="light" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </Group>

      <Card withBorder>
        <FileUpload
          scope="person_photo"
          recordId={p.id}
          attachPath="/me/photo"
          urlPath="/me/photo-url"
          removePath="/me/photo"
          invalidateKey={["my-profile"]}
          storageReady={storageReady}
          variant="avatar"
          crop="circle"
          label="Profile photo"
          size={96}
        />
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">Details</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Given name" value={draft.given_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, given_name: e.currentTarget.value })} />
          <TextInput label="Family name" value={draft.family_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, family_name: e.currentTarget.value })} />
          <TextInput label="Middle name/s" value={draft.middle_names} disabled={ro}
            onChange={(e) => setDraft({ ...draft, middle_names: e.currentTarget.value })} />
          <TextInput label="Display name" value={draft.preferred_name} disabled={ro}
            onChange={(e) => setDraft({ ...draft, preferred_name: e.currentTarget.value })} />
          <DateField label="Date of birth" value={draft.dob} disabled={ro} maxDate={new Date()}
            onChange={(d) => setDraft({ ...draft, dob: d })} />
          <TextInput label="Email (your login)" value={p.email ?? ""} disabled
            description="Contact an admin to change your login email" />
          <PhoneField label="Mobile" value={draft.mobile} disabled={ro}
            onChange={(v) => setDraft({ ...draft, mobile: v })} />
        </SimpleGrid>

        <Divider my="sm" label="Address" labelPosition="left" />
        <Stack gap="sm">
          <TextInput label="Line 1" value={addr.line1} disabled={ro}
            onChange={(e) => setAddr({ ...addr, line1: e.currentTarget.value })} />
          <TextInput label="Line 2" value={addr.line2} disabled={ro}
            onChange={(e) => setAddr({ ...addr, line2: e.currentTarget.value })} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Suburb" value={addr.suburb} disabled={ro}
              onChange={(e) => setAddr({ ...addr, suburb: e.currentTarget.value })} />
            <TextInput label="State" value={addr.state} disabled={ro}
              onChange={(e) => setAddr({ ...addr, state: e.currentTarget.value })} />
            <TextInput label="Postcode" value={addr.postcode} disabled={ro}
              onChange={(e) => setAddr({ ...addr, postcode: e.currentTarget.value })} />
          </SimpleGrid>
        </Stack>

        <Divider my="sm" label="Emergency contacts" labelPosition="left" />
        <Stack gap="sm">
          {ecs.length === 0 && <Text size="sm" c="dimmed">None.</Text>}
          {ecs.map((e, i) => (
            <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
              <TextInput label={i === 0 ? "Name" : undefined} value={e.name} disabled={ro} style={{ flex: 1 }}
                onChange={(ev) => setEcs(ecs.map((x, xi) => (xi === i ? { ...x, name: ev.currentTarget.value } : x)))} />
              <TextInput label={i === 0 ? "Relationship" : undefined} value={e.relationship} disabled={ro} style={{ flex: 1 }}
                onChange={(ev) => setEcs(ecs.map((x, xi) => (xi === i ? { ...x, relationship: ev.currentTarget.value } : x)))} />
              <PhoneField label={i === 0 ? "Phone" : undefined} value={e.phone} disabled={ro}
                onChange={(v) => setEcs(ecs.map((x, xi) => (xi === i ? { ...x, phone: v } : x)))} />
              {!ro && (
                <ActionIcon color="red" variant="subtle" aria-label="Remove"
                  onClick={() => setEcs(ecs.filter((_, xi) => xi !== i))}>
                  <IconX size={16} />
                </ActionIcon>
              )}
            </Group>
          ))}
          {!ro && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} style={{ alignSelf: "flex-start" }}
              onClick={() => setEcs([...ecs, { name: "", relationship: "", phone: "" }])}>
              Add contact
            </Button>
          )}
        </Stack>
      </Card>

      {p.engagements.length > 0 && (
        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4}>My engagements</Title>
            {p.engagements.some((e) => e.engagement_type === "employee") && (
              <Anchor component={Link} to="/me/pay" size="sm">My pay →</Anchor>
            )}
          </Group>
          <Stack gap="xs">
            {p.engagements.map((e) => (
              <Group key={e.id} gap="xs">
                <Badge variant="light" color={e.is_active ? "teal" : "gray"}>
                  {TYPE_LABEL[e.engagement_type] ?? e.engagement_type}
                </Badge>
                <Text size="sm">{e.work_role_name ?? "—"}{e.employment_basis ? ` · ${e.employment_basis.replace("_", "-")}` : ""}</Text>
                {!e.is_active && <Text size="xs" c="dimmed">retired</Text>}
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Card withBorder>
        <Title order={4} mb="sm">My permissions</Title>
        <Text size="sm" c="dimmed" mb="sm">What you're allowed to do in the app.</Text>
        {(me?.capabilities.length ?? 0) === 0 ? (
          <Text size="sm" c="dimmed">No special permissions.</Text>
        ) : (
          <Group gap={6}>
            {me?.capabilities.map((c) => (
              <Badge key={c} variant="light" color="blue">{prettyCap(c)}</Badge>
            ))}
          </Group>
        )}
      </Card>
    </Stack>
  );
}
