// Reusable file/photo uploader built on the S3-presigned-URL flow.
//
// Flow: ask the backend for a presigned PUT (/storage/presign-upload), upload the
// bytes straight to the bucket, then call the record's attach endpoint with the
// returned object key. Display is via a short-TTL presigned GET the backend serves
// per record. Binaries therefore go browser <-> storage directly — the app never
// proxies them and the S3 secret never reaches the client.
//
// Supports: a normal file picker, the phone camera (input capture=environment),
// and desktop webcam capture (getUserMedia). Degrades to a disabled hint when
// file storage isn't configured.

import {
  ActionIcon,
  Anchor,
  Avatar,
  Box,
  Button,
  Flex,
  Group,
  Image,
  Modal,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import { IconCamera, IconFile, IconTrash, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { api } from "../api/client";

export type UploadScope = "horse_photo" | "horse_document" | "person_photo" | "credential";

/** Whether file storage is configured — any authenticated user may probe this. */
export function useStorageStatus(): boolean {
  const q = useQuery({
    queryKey: ["storage-status"],
    queryFn: () => api.get<{ configured: boolean }>("/storage/status"),
    staleTime: 5 * 60 * 1000,
  });
  return q.data?.configured ?? false;
}

type PresignOut = { url: string; key: string };
type ServeOut = { url: string | null };

export interface FileUploadProps {
  scope: UploadScope;
  recordId: number;
  /** Backend path (PUT { key }) that persists the key onto the record. */
  attachPath: string;
  /** Backend path (GET -> { url }) that serves a presigned display/download URL. */
  urlPath: string;
  /** Backend path (DELETE) that detaches + deletes the object. Omit to hide remove. */
  removePath?: string;
  /** React-Query key to invalidate after a change (e.g. ["horse", id]). */
  invalidateKey?: unknown[];
  /** Whether file storage is configured; when false the control is a hint only. */
  storageReady: boolean;
  variant?: "avatar" | "image" | "document";
  /**
   * When "circle", the picked/captured image opens a circular crop modal before
   * upload; the confirmed crop is exported as a 512x512 JPEG square (the circle is
   * display-only). Off by default. Only meaningful for image variants.
   */
  crop?: "circle";
  /** Only managers may edit; viewers still see the display. */
  canEdit?: boolean;
  label?: string;
  size?: number; // avatar/image preview size in px
}

const IMAGE_ACCEPT = "image/*";
const DOC_ACCEPT = "image/*,application/pdf";

export function FileUpload({
  scope,
  recordId,
  attachPath,
  urlPath,
  removePath,
  invalidateKey,
  storageReady,
  variant = "image",
  crop,
  canEdit = true,
  label,
  size = 120,
}: FileUploadProps) {
  const qc = useQueryClient();
  const isImage = variant !== "document";
  const cropMode = crop === "circle" && isImage;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  // Data URL of the image awaiting circular crop (only in crop mode).
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // The presigned display URL (short TTL). Only fetched when storage is ready.
  const urlQ = useQuery({
    queryKey: ["file-url", urlPath],
    queryFn: () => api.get<ServeOut>(urlPath),
    enabled: storageReady,
  });
  const displayUrl = urlQ.data?.url ?? null;

  const refresh = () => {
    urlQ.refetch();
    if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
  };

  async function uploadFile(file: File) {
    setBusy(true);
    try {
      // 1. presigned PUT + the object key to store
      const presign = await api.post<PresignOut>("/storage/presign-upload", {
        scope,
        record_id: recordId,
        filename: file.name || "upload",
      });
      // 2. bytes go straight to the bucket (never through our API)
      const put = await fetch(presign.url, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status}). Check the bucket CORS config.`);
      // 3. persist the key on the record
      await api.put(attachPath, { key: presign.key });
      notifications.show({ color: "teal", message: "Uploaded." });
      refresh();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const removeM = useMutation({
    mutationFn: () => api.del(removePath!),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Removed." });
      refresh();
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  // Route an incoming file (picked or captured) either into the crop modal or
  // straight to upload, depending on mode.
  function handleIncoming(f: File) {
    if (cropMode) {
      const reader = new FileReader();
      reader.onload = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      void uploadFile(f);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = ""; // allow re-picking the same file
    if (f) handleIncoming(f);
  }

  if (!storageReady) {
    return (
      <Text size="sm" c="dimmed">
        {label ? `${label}: ` : ""}File storage is not configured. An administrator can set it up
        under Settings → Integrations.
      </Text>
    );
  }

  const preview = isImage ? (
    variant === "avatar" ? (
      <Avatar src={displayUrl} size={size} radius="xl"
        style={{ border: "3px solid var(--mantine-color-default-border)", boxShadow: "var(--mantine-shadow-xs)" }} />
    ) : displayUrl ? (
      <Image src={displayUrl} w={size} h={size} fit="cover" radius="md" alt={label ?? "image"}
        style={{ border: "1px solid var(--mantine-color-default-border)", boxShadow: "var(--mantine-shadow-xs)" }} />
    ) : (
      <Box
        w={size}
        h={size}
        style={{
          borderRadius: "var(--mantine-radius-md)",
          border: "1px dashed var(--mantine-color-default-border)",
          background: "var(--mantine-color-default)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <IconCamera size={28} opacity={0.35} />
      </Box>
    )
  ) : (
    <Group gap="xs">
      <IconFile size={20} opacity={0.6} />
      {displayUrl ? (
        <Anchor href={displayUrl} target="_blank" rel="noreferrer" size="sm">
          View / download {label ?? "document"}
        </Anchor>
      ) : (
        <Text size="sm" c="dimmed">No {label ?? "document"} uploaded.</Text>
      )}
    </Group>
  );

  return (
    <Stack gap="xs">
      {label && <Text size="sm" fw={500}>{label}</Text>}
      {/* CRED-UPLOAD-NARROW: a document upload stacks (control under the "No … on
          file" line) on narrow screens; avatar/image keep their side-by-side layout. */}
      <Flex
        direction={variant === "document" ? { base: "column", sm: "row" } : "row"}
        align={variant === "document" ? { base: "flex-start", sm: "center" } : "center"}
        gap="md"
        wrap="wrap"
      >
        {preview}
        {canEdit && (
          <Stack gap={6}>
            <input
              ref={fileRef}
              type="file"
              accept={isImage ? IMAGE_ACCEPT : DOC_ACCEPT}
              capture={isImage ? "environment" : undefined}
              style={{ display: "none" }}
              onChange={onPick}
            />
            <Group gap={6}>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconUpload size={14} />}
                loading={busy}
                onClick={() => fileRef.current?.click()}
              >
                {displayUrl ? "Replace" : "Upload"}
              </Button>
              {isImage && (
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconCamera size={14} />}
                  disabled={busy}
                  onClick={() => setCamOpen(true)}
                >
                  Camera
                </Button>
              )}
              {removePath && displayUrl && (
                <ActionIcon
                  color="red"
                  variant="subtle"
                  aria-label="Remove"
                  loading={removeM.isPending}
                  onClick={() => removeM.mutate()}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {variant === "avatar" ? "A square photo works best (JPG or PNG). Use a file, or your camera." : "Pick a file, or use your device / webcam camera."}
            </Text>
          </Stack>
        )}
      </Flex>
      {camOpen && (
        <WebcamCapture
          onClose={() => setCamOpen(false)}
          onCapture={(file) => {
            setCamOpen(false);
            handleIncoming(file);
          }}
        />
      )}
      {cropSrc && (
        <CircleCropModal
          src={cropSrc}
          onClose={() => setCropSrc(null)}
          onConfirm={(file) => {
            setCropSrc(null);
            void uploadFile(file);
          }}
        />
      )}
    </Stack>
  );
}

// Circular crop modal: displays the image behind a round mask with drag + zoom,
// then exports the bounding-square region as a 512x512 JPEG (a real square image,
// not a transparent circle — the round shape is display-only).
const CROP_OUTPUT_PX = 512;

function CircleCropModal({
  src,
  onClose,
  onConfirm,
}: {
  src: string;
  onClose: () => void;
  onConfirm: (file: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  async function confirm() {
    if (!areaPixels) return;
    setWorking(true);
    try {
      const blob = await cropToSquareBlob(src, areaPixels);
      onConfirm(new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch {
      notifications.show({ color: "red", message: "Could not process the image." });
      setWorking(false);
    }
  }

  return (
    <Modal opened onClose={onClose} title="Position your photo" centered size="lg">
      <Stack>
        <Box
          style={{
            position: "relative",
            width: "100%",
            height: 320,
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={4}
            zoomWithScroll
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
          />
        </Box>
        <Group gap="sm" align="center" wrap="nowrap">
          <Text size="sm" c="dimmed">Zoom</Text>
          <Slider
            flex={1}
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={setZoom}
            label={null}
          />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={working}>Cancel</Button>
          <Button loading={working} disabled={!areaPixels} onClick={() => void confirm()}>
            Use photo
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// Draw the cropped source rect onto a fixed 512x512 canvas -> JPEG blob (~0.9).
function cropToSquareBlob(src: string, area: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CROP_OUTPUT_PX;
      canvas.height = CROP_OUTPUT_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(
        img,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        CROP_OUTPUT_PX,
        CROP_OUTPUT_PX,
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

// Desktop webcam capture via getUserMedia -> canvas -> JPEG File.
function WebcamCapture({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => setError("Could not access the camera. Check browser permissions."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  return (
    <Modal opened onClose={onClose} title="Take a photo" centered size="lg">
      <Stack>
        {error ? (
          <Text c="red" size="sm">{error}</Text>
        ) : (
          <video ref={videoRef} playsInline style={{ width: "100%", borderRadius: 8, background: "#000" }} />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button leftSection={<IconCamera size={16} />} disabled={!!error} onClick={snap}>
            Capture
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
