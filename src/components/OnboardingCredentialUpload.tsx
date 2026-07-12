import { ActionIcon, Button, Group, Text } from "@mantine/core";
import { IconCircleCheck, IconUpload, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { api } from "../api/client";

interface PresignOut { url: string; key: string }

/** Credential-copy uploader for the (unauthenticated) onboarding form (UAT#3 CRED-1).
 *  Presigns with the onboarding token, uploads straight to the bucket, and hands the
 *  object key back so it's submitted with the form (CredentialIn.image_key). */
export function OnboardingCredentialUpload({ token, imageKey, onKey }: {
  token: string; imageKey: string; onKey: (key: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const presign = await api.post<PresignOut>("/storage/onboarding-presign", {
        token, filename: file.name || "credential", content_type: file.type || null,
      });
      const put = await fetch(presign.url, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      onKey(presign.key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment"
        style={{ display: "none" }} onChange={onPick} />
      {imageKey ? (
        <Group gap={6} wrap="nowrap">
          <IconCircleCheck size={16} color="var(--mantine-color-teal-6)" />
          <Text size="xs" c="teal">Copy attached</Text>
          <ActionIcon size="sm" variant="subtle" color="red" aria-label="Remove copy" onClick={() => onKey("")}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      ) : (
        <Button size="xs" variant="light" leftSection={<IconUpload size={14} />} loading={busy}
          onClick={() => fileRef.current?.click()}>
          Attach a copy / photo
        </Button>
      )}
      {error && <Text size="xs" c="red" mt={2}>{error}</Text>}
    </div>
  );
}
