import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { RiderFields, emptyRider, riderPayload, validateRider } from "./riderForm";

/** Add-rider-to-existing-account: attaches a new-or-existing rider (with the same
 * rider-profile step + duplicate guard + minor-guardian rules) to a known holder. */
export function AddRiderModal({
  opened, onClose, accountHolderId, holderName, holderPhone, holderEmail,
}: {
  opened: boolean;
  onClose: () => void;
  accountHolderId: number;
  holderName?: string;
  holderPhone?: string;
  holderEmail?: string;
}) {
  const qc = useQueryClient();
  const [rider, setRider] = useState(emptyRider());
  const [error, setError] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: () => api.post(`/account-holders/${accountHolderId}/students`, riderPayload(rider)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      notifications.show({ color: "teal", message: "Rider added to the account." });
      setRider(emptyRider());
      setError(null);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    setError(null);
    const err = validateRider(rider);
    if (err) return setError(err);
    saveM.mutate();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add a rider to this account" size="lg">
      <Stack>
        <RiderFields rider={rider} update={(patch) => setRider((r) => ({ ...r, ...patch }))}
          holderName={holderName} holderPhone={holderPhone} holderEmail={holderEmail} />
        {error && <Text c="red" size="sm">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saveM.isPending} onClick={submit}>Add rider</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
