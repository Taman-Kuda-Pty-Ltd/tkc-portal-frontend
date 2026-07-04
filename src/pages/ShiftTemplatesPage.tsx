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
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ShiftTemplate, ShiftTemplateApplyResult } from "../api/types";
import { useAuth } from "../auth/AuthContext";

export function ShiftTemplatesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [applyFor, setApplyFor] = useState<ShiftTemplate | null>(null);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [preview, setPreview] = useState<ShiftTemplateApplyResult | null>(null);

  const templatesQ = useQuery({
    queryKey: ["shift-templates"],
    queryFn: () => api.get<ShiftTemplate[]>("/shift-templates"),
  });

  function closeApply() {
    setApplyFor(null);
    setRange([null, null]);
    setPreview(null);
  }

  function applyBody(extra: Record<string, unknown>) {
    return {
      range_start: dayjs(range[0]!).format("YYYY-MM-DD"),
      range_end: dayjs(range[1]!).format("YYYY-MM-DD"),
      ...extra,
    };
  }

  // Step 1: dry run to find out how many shifts (and duplicates) would result.
  const previewM = useMutation({
    mutationFn: () =>
      api.post<ShiftTemplateApplyResult>(
        `/shift-templates/${applyFor!.id}/apply`,
        applyBody({ dry_run: true }),
      ),
    onSuccess: (res) => setPreview(res),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Step 2: actually create, optionally skipping duplicates.
  const commitM = useMutation({
    mutationFn: (skipDuplicates: boolean) =>
      api.post<ShiftTemplateApplyResult>(
        `/shift-templates/${applyFor!.id}/apply`,
        applyBody({ skip_duplicates: skipDuplicates }),
      ),
    onSuccess: (res) => {
      notifications.show({
        color: "teal",
        message: `Created ${res.created_count} shift${res.created_count === 1 ? "" : "s"}.`,
      });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      closeApply();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.del(`/shift-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-templates"] }),
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const canManageTemplates = can("manage_shift_templates");
  const canApply = can("manage_shifts");

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Templates</Title>
        {canManageTemplates && <Button onClick={() => navigate("/templates/new")}>New template</Button>}
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
                      <Button variant="subtle" onClick={() => navigate(`/templates/${t.id}`)}>
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

      <Modal opened={!!applyFor} onClose={closeApply} title={`Apply "${applyFor?.name ?? ""}"`}>
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
            onChange={(v) => {
              setRange(v);
              setPreview(null);
            }}
          />

          {!preview && (
            <Button
              disabled={!range[0] || !range[1]}
              loading={previewM.isPending}
              onClick={() => previewM.mutate()}
            >
              Check
            </Button>
          )}

          {preview && preview.requested_count === 0 && (
            <>
              <Text size="sm">This template generates no shifts in that range.</Text>
              <Button variant="default" onClick={() => setPreview(null)}>
                Back
              </Button>
            </>
          )}

          {preview && preview.requested_count > 0 && preview.duplicate_count === 0 && (
            <>
              <Text size="sm">
                Will create <b>{preview.requested_count}</b> shift
                {preview.requested_count === 1 ? "" : "s"}.
              </Text>
              <Button loading={commitM.isPending} onClick={() => commitM.mutate(false)}>
                Create {preview.requested_count} shifts
              </Button>
            </>
          )}

          {preview && preview.duplicate_count > 0 && (
            <>
              <Text size="sm">
                {preview.requested_count} shift{preview.requested_count === 1 ? "" : "s"} match
                this range, but <b>{preview.duplicate_count}</b> already exist — applying again
                would duplicate {preview.duplicate_count === 1 ? "it" : "them"}.
              </Text>
              <Button
                loading={commitM.isPending}
                onClick={() => commitM.mutate(true)}
                disabled={preview.requested_count - preview.duplicate_count === 0}
              >
                Skip duplicates — create {preview.requested_count - preview.duplicate_count}
              </Button>
              <Button
                variant="light"
                color="orange"
                loading={commitM.isPending}
                onClick={() => commitM.mutate(false)}
              >
                Create all anyway ({preview.requested_count})
              </Button>
              <Button variant="subtle" onClick={() => setPreview(null)}>
                Back
              </Button>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
