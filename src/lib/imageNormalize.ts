// Normalise picked uploads to the formats the server accepts (HEIC-NORMALIZE):
//   - images → always JPG (HEIC/HEIF decoded via heic2any, everything else via canvas)
//   - documents → JPG, or a PDF passed through unchanged
// Conversion is client-side; the backend validates the resulting extension.

const HEIC_RE = /\.(heic|heif)$/i;

function isHeic(file: File): boolean {
  return HEIC_RE.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn't be read as an image."));
    img.src = url;
  });
}

/** Decode any image (including HEIC) and re-encode as a JPEG blob. */
async function toJpegBlob(file: File, quality = 0.9): Promise<Blob> {
  let src: Blob = file;
  if (isHeic(file)) {
    // Loaded on demand (the libheif WASM is large) so it never bloats the main bundle.
    const heic2any = (await import("heic2any")).default;
    src = (await heic2any({ blob: file, toType: "image/jpeg", quality })) as Blob;
  }
  const url = URL.createObjectURL(src);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image conversion is not supported in this browser.");
    ctx.fillStyle = "#ffffff"; // flatten any transparency onto white for JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode the image as JPG."))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Normalise a picked file for upload.
 * @param allowPdf true for document scopes (a PDF is kept; images become JPG).
 */
export async function normalizeUpload(file: File, allowPdf: boolean): Promise<File> {
  if (allowPdf && isPdf(file)) return file; // documents keep a real PDF
  const jpeg = await toJpegBlob(file);
  const base = (file.name.replace(/\.[^.]+$/, "") || "upload").slice(0, 80);
  return new File([jpeg], `${base}.jpg`, { type: "image/jpeg" });
}
