import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { api } from "../api/client";
import type { Shift, Template } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { TemplateEditor } from "../components/TemplateEditor";

export function TemplatesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [applyFor, setApplyFor] = useState<Template | null>(null);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<Template[]>("/templates"),
  });

  const applyM = useMutation({
    mutationFn: (v: { id: number; start: string; end: string }) =>
      api.post<Shift[]>(`/templates/${v.id}/apply`, {
        range_start: v.start,
        range_end: v.end,
      }),
    onSuccess: (shifts) => {
      notifications.show({
        color: "teal",
        message: `Generated ${shifts.length} shift${shifts.length === 1 ? "" : "s"}.`,
      });
      setApplyFor(null);
      setRange([null, null]);
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.del(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const canManageTemplates = can("manage_templates");
  const canApply = can("manage_shifts");

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Templates</Title>
        {canManageTemplates && <Button onClick={() => setCreating(true)}>New template</Button>}
      </Group>
      <Text size="sm" c="dimmed">
        Reusable recurring patterns. Applying one generates independent shifts you
        can then edit on the schedule.
      </Text>

      {templatesQ.isLoading ? (
        <Loader />
      ) : (templatesQ.data ?? []).length === 0 ? (
        <Text c="dimmed">No templates yet.</Text>
      ) : (
        <Stack>
          {(templatesQ.data ?? []).map((t) => (
            <Card key={t.id} withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Group gap="xs">
                    <Text fw={600}>{t.name}</Text>
                    <Badge variant="light">{t.recurrence}</Badge>
                    <Badge variant="light" color="gray">
                      {t.slots.length} slot{t.slots.length === 1 ? "" : "s"}
                    </Badge>
                  </Group>
                  {t.description && (
                    <Text size="sm" c="dimmed">
                      {t.description}
                    </Text>
                  )}
                </div>
                <Group gap="xs">
                  {canManageTemplates && (
                    <>
                      <Button variant="subtle" onClick={() => setEditing(t)}>
                        Edit
                      </Button>
                      <Button
                        variant="subtle"
                        color="red"
                        onClick={() => deleteM.mutate(t.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  {canApply && (
                    <Button variant="light" onClick={() => setApplyFor(t)}>
                      Apply…
                    </Button>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <TemplateEditor
        template={editing}
        opened={editing !== null || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />

      <Modal
        opened={!!applyFor}
        onClose={() => setApplyFor(null)}
        title={`Apply "${applyFor?.name ?? ""}"`}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Generate shifts for every date in the range that matches this template's
            pattern.
          </Text>
          <DatePickerInput
            type="range"
            label="Date range"
            placeholder="Pick start and end"
            value={range}
            onChange={setRange}
          />
          <Button
            disabled={!range[0] || !range[1]}
            loading={applyM.isPending}
            onClick={() =>
              applyFor &&
              range[0] &&
              range[1] &&
              applyM.mutate({
                id: applyFor.id,
                start: dayjs(range[0]).format("YYYY-MM-DD"),
                end: dayjs(range[1]).format("YYYY-MM-DD"),
              })
            }
          >
            Generate shifts
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
