export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const DISPLAY_MAX_EDGE = 2400;
export const DISPLAY_WIDTHS = Object.freeze([400, 800, 1200, 1600, 2400]);
export const IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const OBJECT_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

/**
 * Scale an image to fit inside a square without upscaling or distorting.
 * @param {number} width
 * @param {number} height
 * @param {number} [maxEdge]
 */
export function fitWithin(width, height, maxEdge = DISPLAY_MAX_EDGE) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maxEdge) ||
    maxEdge <= 0
  ) {
    return { width: 0, height: 0, scale: 0, resized: false };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, scale: 1, resized: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
    resized: true,
  };
}

/**
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @param {{ maxBytes?: number, mimeTypes?: readonly string[] }} [options]
 */
export function validateUploadFile(file, options = {}) {
  const maxBytes = options.maxBytes ?? IMAGE_MAX_BYTES;
  const mimeTypes = options.mimeTypes ?? IMAGE_MIME_TYPES;
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return {
      ok: false,
      error: "Choose a JPG, PNG or WebP image under 10 MB.",
    };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: "Images must be under 10 MB." };
  }
  if (!mimeTypes.includes(file.type ?? "")) {
    return {
      ok: false,
      error: "Choose a JPG, PNG or WebP image under 10 MB.",
    };
  }
  return { ok: true };
}

/** @param {unknown} value */
export function isImageObjectKey(value) {
  return typeof value === "string" && OBJECT_KEY_RE.test(value);
}

/** @param {unknown} value */
export function looksLikeSignedUrl(value) {
  if (typeof value !== "string") return false;
  return (
    value.includes("/storage/v1/object/sign") ||
    value.includes("/object/sign/") ||
    /(?:\?|&)token=/.test(value)
  );
}

/**
 * @param {string} supabaseUrl
 * @param {string} key
 * @param {number} [width]
 */
export function publicPortfolioUrl(supabaseUrl, key, width) {
  const base = String(supabaseUrl ?? "").replace(/\/$/, "");
  if (!base || !isImageObjectKey(key)) return "";
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  if (width && DISPLAY_WIDTHS.includes(width)) {
    return `${base}/storage/v1/render/image/public/portfolio-images/${encoded}?width=${width}&resize=contain`;
  }
  return `${base}/storage/v1/object/public/portfolio-images/${encoded}`;
}
