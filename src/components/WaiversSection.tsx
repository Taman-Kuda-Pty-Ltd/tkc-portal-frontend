import {
  Accordion, ActionIcon, Alert, Button, Card, Checkbox, Divider, Group, Modal,
  Stack, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { IconAlertTriangle, IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Waiver, WaiverPending, WaiverSectionT, WaiverVersion } from "../api/types";
import { DateField } from "./DateField";

interface EditSection { title: string; intro: string; items: string }
const toEdit = (s: WaiverSectionT): EditSection => ({ title: s.title, intro: s.intro ?? "", items: s.items.join("\n") });
const fromEdit = (s: EditSection): WaiverSectionT => ({
  title: s.title.trim(), intro: s.intro.trim() || null,
  items: s.items.split("\n").map((l) => l.trim()).filter(Boolean),
});

/** WAIVER-VERSIONING: author versioned waivers and record signatures (manager-driven).
 * Publishing is immutable — each edit is a new version; ticking "significant" forces
 * everyone to re-sign. Pending students surface here and in the attention badge. */
export function WaiversSection() {
  const qc = useQueryClient();
  const waiversQ = useQuery({ queryKey: ["waivers"], queryFn: () => api.get<Waiver[]>("/waivers") });
  const pendingQ = useQuery({ queryKey: ["waiver-pending"], queryFn: () => api.get<WaiverPending[]>("/waivers/pending-signatures") });
  const waiver = waiversQ.data?.[0];

  const [newName, setNewName] = useState("");
  const [signing, setSigning] = useState<WaiverPending | null>(null);

  const createM = useMutation({
    mutationFn: () => api.post("/waivers", { name: newName.trim() || "Waiver" }),
    onSuccess: () => { setNewName(""); qc.invalidateQueries({ queryKey: ["waivers"] }); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["waivers"] });
    qc.invalidateQueries({ queryKey: ["waiver-pending"] });
    qc.invalidateQueries({ queryKey: ["waiver-pending-count"] });
  };

  return (
    <Stack gap="md">
      {!waiver ? (
        <Card withBorder>
          <Text size="sm" c="dimmed" mb="xs">No waiver yet. Create one, then publish its first version.</Text>
          <Group align="flex-end">
            <TextInput label="Waiver name" placeholder="e.g. Riding Lesson Waiver" value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button loading={createM.isPending} onClick={() => createM.mutate()}>Create</Button>
          </Group>
        </Card>
      ) : (
        <>
          <Group justify="space-between">
            <div>
              <Title order={4}>{waiver.name}</Title>
              <Text size="xs" c="dimmed">
                {waiver.current_version
                  ? `Current: v${waiver.current_version.version_no}${waiver.current_version.significant ? " (significant)" : ""} · ${waiver.version_count} version(s)`
                  : "No version published yet"}
              </Text>
            </div>
          </Group>

          <PublishVersion waiver={waiver} onDone={invalidateAll} />

          <Card withBorder>
            <Text fw={600} mb={6}>Awaiting signature ({pendingQ.data?.length ?? 0})</Text>
            {(pendingQ.data ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">Everyone has signed the current version.</Text>
            ) : (
              <Stack gap={6}>
                {(pendingQ.data ?? []).map((p) => (
                  <Group key={p.student_id} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={500}>{p.student_name}</Text>
                      <Text size="xs" c="dimmed">
                        {p.reason}{p.account_holder_name ? ` · holder: ${p.account_holder_name}` : ""}
                      </Text>
                    </div>
                    <Button size="xs" variant="light" disabled={!waiver.current_version}
                      onClick={() => setSigning(p)}>Record signature</Button>
                  </Group>
                ))}
              </Stack>
            )}
          </Card>
        </>
      )}

      {signing && waiver?.current_version && (
        <SignModal pending={signing} version={waiver.current_version}
          onClose={() => setSigning(null)} onSigned={() => { setSigning(null); invalidateAll(); }} />
      )}
    </Stack>
  );
}

function PublishVersion({ waiver, onDone }: { waiver: Waiver; onDone: () => void }) {
  const cur = waiver.current_version;
  const [html, setHtml] = useState(cur?.html ?? "");
  const [significant, setSignificant] = useState(false);
  const [sections, setSections] = useState<EditSection[]>((cur?.sections ?? []).map(toEdit));

  const pubM = useMutation({
    mutationFn: () => api.post(`/waivers/${waiver.id}/versions`, {
      html, significant, sections: sections.map(fromEdit).filter((s) => s.title),
    }),
    onSuccess: () => { notifications.show({ color: "teal", message: "New version published" }); onDone(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const setSec = (i: number, patch: Partial<EditSection>) =>
    setSections((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <Accordion variant="separated">
      <Accordion.Item value="publish">
        <Accordion.Control><Text fw={600}>Publish a new version</Text></Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Publishing creates an immutable new version (starts from the current one).
              Tick "significant" only when the change requires everyone to re-sign.
            </Text>
            <Textarea label="Intro (HTML)" autosize minRows={2} value={html}
              onChange={(e) => setHtml(e.currentTarget.value)} />
            {sections.map((s, i) => (
              <Card key={i} withBorder padding="sm">
                <Group justify="space-between" mb={4}>
                  <TextInput label="Section title" value={s.title} style={{ flex: 1 }}
                    onChange={(e) => setSec(i, { title: e.currentTarget.value })} />
                  <ActionIcon color="red" variant="subtle" mt={22} aria-label="Remove section"
                    onClick={() => setSections(sections.filter((_, idx) => idx !== i))}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
                <TextInput label="Intro (optional)" value={s.intro}
                  onChange={(e) => setSec(i, { intro: e.currentTarget.value })} />
                <Textarea label="Acknowledgement items (one per line)" autosize minRows={2} mt={4}
                  value={s.items} onChange={(e) => setSec(i, { items: e.currentTarget.value })} />
              </Card>
            ))}
            <Group justify="space-between">
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
                onClick={() => setSections([...sections, { title: "", intro: "", items: "" }])}>
                Add section
              </Button>
              <Checkbox label="Significant change (everyone must re-sign)" checked={significant}
                onChange={(e) => setSignificant(e.currentTarget.checked)} />
            </Group>
            <Group justify="flex-end">
              <Button loading={pubM.isPending} onClick={() => pubM.mutate()}>Publish version</Button>
            </Group>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

function SignModal({ pending, version, onClose, onSigned }: {
  pending: WaiverPending; version: WaiverVersion; onClose: () => void; onSigned: () => void;
}) {
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [name, setName] = useState(pending.account_holder_name ?? "");
  const [when, setWhen] = useState<Date | null>(new Date());

  const required: string[] = [];
  version.sections.forEach((s, si) => s.items.forEach((_it, ii) => required.push(`${si}:${ii}`)));
  const allTicked = required.every((k) => ticks[k]);

  const signM = useMutation({
    mutationFn: () => api.post(`/waivers/versions/${version.id}/sign`, {
      signer_person_id: pending.account_holder_person_id ?? pending.student_person_id,
      on_behalf_of_person_id: pending.student_person_id,
      typed_name: name.trim(),
      signed_on: when ? dayjs(when).format("YYYY-MM-DD") : null,
      acknowledgements: ticks,
    }),
    onSuccess: () => { notifications.show({ color: "teal", message: "Signature recorded" }); onSigned(); },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title={`Sign — ${pending.student_name}`} size="lg">
      <Stack>
        <Alert color="gray" variant="light">
          <Text size="xs">This waiver covers <b>{pending.student_name}</b>. The account holder /
            guardian signs on their behalf.</Text>
        </Alert>
        {version.html && <div dangerouslySetInnerHTML={{ __html: version.html }} />}
        {version.sections.map((s, si) => (
          <div key={si}>
            <Text fw={600} size="sm">{s.title}</Text>
            {s.intro && <Text size="xs" c="dimmed" mb={4} style={{ whiteSpace: "pre-wrap" }}>{s.intro}</Text>}
            <Stack gap={4}>
              {s.items.map((it, ii) => (
                <Checkbox key={ii} size="xs" checked={!!ticks[`${si}:${ii}`]}
                  onChange={(e) => setTicks((t) => ({ ...t, [`${si}:${ii}`]: e.currentTarget.checked }))}
                  label={it} />
              ))}
            </Stack>
            <Divider my="xs" />
          </div>
        ))}
        {!allTicked && (
          <Group gap={6} c="orange"><IconAlertTriangle size={16} />
            <Text size="xs">Tick every acknowledgement to sign.</Text></Group>
        )}
        <Group align="flex-end">
          <TextInput label="Signature (type full name)" value={name} required style={{ flex: 1 }}
            onChange={(e) => setName(e.currentTarget.value)} />
          <DateField label="Date" value={when} onChange={(d) => setWhen(d as Date | null)} />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={signM.isPending} disabled={!allTicked || !name.trim()}
            onClick={() => signM.mutate()}>Sign</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
