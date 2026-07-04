import { Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

export function OrgSettingsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<{ min_shift_hours: number }>("/settings/org"),
  });
  const [hours, setHours] = useState<number | string>(1);
  useEffect(() => {
    if (q.data) setHours(q.data.min_shift_hours);
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () => api.put("/settings/org", { min_shift_hours: Number(hours) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      notifications.show({ color: "teal", message: "Saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        The minimum paid hours recorded for any terminal check-out. If someone works
        (or logs) less than this, their hours are floored to it.
      </Text>
      <Group align="flex-end">
        <NumberInput label="Minimum shift hours" min={0} step={0.25} w={180}
          value={hours} onChange={setHours} />
        <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
      </Group>
    </Stack>
  );
}
