import {
  DISPLAY_MAX_EDGE,
  IMAGE_MAX_BYTES,
  fitWithin,
  validateUploadFile,
} from "./fit.mjs";

export {
  DISPLAY_MAX_EDGE,
  DISPLAY_WIDTHS,
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  fitWithin,
  isImageObjectKey,
  looksLikeSignedUrl,
  publicPortfolioUrl,
  validateUploadFile,
} from "./fit.mjs";

function extensionFor(type: string) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

export async function processImageForUpload(
  file: File,
  maxEdge = DISPLAY_MAX_EDGE,
): Promise<File> {
  const check = validateUploadFile(file);
  if (!check.ok) throw new Error(check.error);
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const fitted = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (!fitted.resized) return file;
    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, fitted.width, fitted.height);
    const type =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.86 : undefined),
    );
    if (!blob) return file;
    if (blob.size > IMAGE_MAX_BYTES) {
      throw new Error("Images must be under 10 MB.");
    }
    const name = file.name.replace(/\.[^.]+$/, extensionFor(type));
    return new File([blob], name, { type, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
