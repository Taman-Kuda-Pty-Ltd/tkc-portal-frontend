import {
  Alert, Badge, Button, Card, Checkbox, Divider, Group, Modal, Stack, Text, TextInput, Title,
} from "@mantine/core";
import { IconFileText } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { WaiverVersion } from "../api/types";
import { DateField } from "./DateField";

interface MyWaiverStudent { person_id: number; name: string; signed: boolean }
interface MyWaivers { waiver_name: string | null; version: WaiverVersion | null; students: MyWaiverStudent[] }

/** FU-WAIVER-SIGN-PORTAL: an account holder signs the club waiver for their own students
 * from their profile — no manager needed. Only shows when something is outstanding. */
export function MyWaiversCard() {
  const q = useQuery({ queryKey: ["my-waivers"], queryFn: () => api.get<MyWaivers>("/me/waivers") });
  const [signing, setSigning] = useState<MyWaiverStudent | null>(null);
  const data = q.data;
  const pending = (data?.students ?? []).filter((s) => !s.signed);
  if (!data || !data.version || pending.length === 0) return null;

  return (
    <Card withBorder>
      <Group gap={8} mb="sm">
        <IconFileText size={18} />
        <Title order={4}>{data.waiver_name ?? "Waiver"} — signature needed</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="xs">
        Please read and sign the current waiver for each rider on your account.
      </Text>
      <Stack gap={6}>
        {pending.map((s) => (
          <Group key={s.person_id} justify="space-between">
            <Group gap={8}>
              <Text size="sm" fw={500}>{s.name}</Text>
              <Badge color="orange" variant="light" size="sm">Not signed</Badge>
            </Group>
            <Button size="xs" variant="light" onClick={() => setSigning(s)}>Read &amp; sign</Button>
          </Group>
        ))}
      </Stack>
      {signing && data.version && (
        <SignModal student={signing} version={data.version}
          onClose={() => setSigning(null)} onSigned={() => setSigning(null)} />
      )}
    </Card>
  );
}

function SignModal({ student, version, onClose, onSigned }: {
  student: MyWaiverStudent; version: WaiverVersion; onClose: () => void; onSigned: () => void;
}) {
  const qc = useQueryClient();
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [when, setWhen] = useState<Date | null>(new Date());

  const required: string[] = [];
  version.sections.forEach((s, si) => s.items.forEach((_i, ii) => required.push(`${si}:${ii}`)));
  const allTicked = required.every((k) => ticks[k]);

  const signM = useMutation({
    mutationFn: () => api.post("/me/waivers/sign", {
      on_behalf_of_person_id: student.person_id,
      typed_name: name.trim(),
      signed_on: when ? dayjs(when).format("YYYY-MM-DD") : null,
      acknowledgements: ticks,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-waivers"] });
      notifications.show({ color: "teal", message: "Waiver signed. Thank you." });
      onSigned();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Modal opened onClose={onClose} title={`Sign — ${student.name}`} size="lg">
      <Stack>
        <Alert color="gray" variant="light">
          <Text size="xs">This waiver covers <b>{student.name}</b>. By signing you confirm you
            are their parent/guardian (or the rider, if that's you).</Text>
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
        <Group align="flex-end">
          <TextInput label="Signature (type your full name)" value={name} required style={{ flex: 1 }}
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
