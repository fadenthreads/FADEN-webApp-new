import { NextResponse } from "next/server.js";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireAdminAal2,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "./request-guards.mjs";

export const STORAGE_BUCKETS = Object.freeze({
  portfolioImages: "portfolio-images",
  requestInspirations: "request-inspirations",
  orderFiles: "order-files",
  verificationDocuments: "verification-documents",
});

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 15 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 900;
export const IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ORDER_FILE_PURPOSES = Object.freeze([
  "customer",
  "atelier",
  "shared",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PATH_RE =
  /^[0-9a-f-]{36}(?:\/(?:customer|atelier|shared))?\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp|pdf)$/i;

const BUCKET_CONFIG = {
  "portfolio-images": {
    images: true,
    pdf: false,
    purposes: null,
  },
  "request-inspirations": {
    images: true,
    pdf: false,
    purposes: null,
  },
  "order-files": {
    images: true,
    pdf: true,
    purposes: ORDER_FILE_PURPOSES,
  },
  "verification-documents": {
    images: true,
    pdf: true,
    purposes: null,
  },
};

const AUDIENCE_UPLOADS = {
  marketplace: {
    "request-inspirations": { purposes: null, multipartOnly: true },
    "order-files": { purposes: ["customer", "shared"] },
  },
  studio: {
    "portfolio-images": { purposes: null },
    "order-files": { purposes: ["atelier", "shared"] },
    "verification-documents": { purposes: null },
  },
  admin: {},
};

const AUDIENCE_DOWNLOADS = {
  marketplace: ["request-inspirations", "order-files"],
  studio: [
    "portfolio-images",
    "request-inspirations",
    "order-files",
    "verification-documents",
  ],
  admin: ["verification-documents"],
};

export class StorageGrantError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   */
  constructor(message, status, code) {
    super(message);
    this.name = "StorageGrantError";
    this.status = status;
    this.code = code;
  }
}

/** @param {unknown} value */
export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** @param {string} mimeType */
export function extensionForMime(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return null;
}

/** @param {string} bucket @param {string} mimeType */
export function maxBytesFor(bucket, mimeType) {
  const config = BUCKET_CONFIG[bucket];
  if (!config) return 0;
  if (mimeType === "application/pdf") return config.pdf ? PDF_MAX_BYTES : 0;
  if (IMAGE_MIME_TYPES.includes(mimeType))
    return config.images ? IMAGE_MAX_BYTES : 0;
  return 0;
}

/**
 * @param {Uint8Array | ArrayBuffer | Buffer} input
 * @param {string} [declaredType]
 */
export function detectAllowedMime(input, declaredType) {
  const bytes = toBytes(input);
  const detected =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71
        ? "image/png"
        : bytes.length >= 12 &&
            ascii(bytes, 0, 4) === "RIFF" &&
            ascii(bytes, 8, 4) === "WEBP"
          ? "image/webp"
          : ascii(bytes, 0, 4) === "%PDF"
            ? "application/pdf"
            : null;
  if (!detected) return null;
  if (declaredType && declaredType !== detected) return null;
  return detected;
}

/**
 * @param {{
 *   audience: 'marketplace' | 'studio' | 'admin',
 *   userId: string,
 *   bucket: string,
 *   subjectId: string,
 *   purpose?: string | null,
 *   mimeType: string,
 *   byteSize: number,
 *   objectId?: string,
 * }} input
 */
export function createUploadGrant(input) {
  const audience = input.audience;
  const bucket = input.bucket;
  const allow = AUDIENCE_UPLOADS[audience]?.[bucket];
  if (!allow) {
    throw new StorageGrantError(
      "This upload is not available.",
      403,
      "forbidden",
    );
  }
  if (allow.multipartOnly) {
    throw new StorageGrantError(
      "Inspiration images must be uploaded through the processing route.",
      400,
      "multipart_required",
    );
  }
  if (!isUuid(input.userId) || !isUuid(input.subjectId)) {
    throw new StorageGrantError(
      "Invalid storage subject.",
      400,
      "invalid_subject",
    );
  }
  const purpose = input.purpose ?? null;
  if (allow.purposes) {
    if (!purpose || !allow.purposes.includes(purpose)) {
      throw new StorageGrantError(
        "This file purpose is not available.",
        403,
        "forbidden",
      );
    }
  } else if (purpose) {
    throw new StorageGrantError("This file purpose is not available.", 400);
  }
  const mimeType = input.mimeType;
  const limit = maxBytesFor(bucket, mimeType);
  if (!limit || !extensionForMime(mimeType)) {
    throw new StorageGrantError(
      "The file does not match a supported format.",
      400,
      "unsupported_type",
    );
  }
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) {
    throw new StorageGrantError("Choose a file within the size limit.", 400);
  }
  if (input.byteSize > limit) {
    throw new StorageGrantError(
      mimeType === "application/pdf"
        ? "Verification PDFs must be under 15 MB."
        : "Images must be under 10 MB.",
      413,
      "payload_too_large",
    );
  }
  return {
    bucket,
    mimeType,
    purpose,
    path: buildStorageObjectPath({
      bucket,
      userId: input.userId,
      subjectId: input.subjectId,
      purpose,
      mimeType,
      objectId: input.objectId,
    }),
  };
}

/**
 * @param {{
 *   audience: 'marketplace' | 'studio' | 'admin',
 *   bucket: string,
 *   path: string,
 * }} input
 */
export function createDownloadGrant(input) {
  const allowed = AUDIENCE_DOWNLOADS[input.audience] ?? [];
  if (!allowed.includes(input.bucket) || !BUCKET_CONFIG[input.bucket]) {
    throw new StorageGrantError(
      "This file is not available.",
      404,
      "not_found",
    );
  }
  if (!isSafeObjectPath(input.path, input.bucket)) {
    throw new StorageGrantError(
      "This file is not available.",
      404,
      "not_found",
    );
  }
  return { bucket: input.bucket, path: input.path };
}

/**
 * @param {{
 *   bucket: string,
 *   userId: string,
 *   subjectId: string,
 *   purpose?: string | null,
 *   mimeType: string,
 *   objectId?: string,
 * }} input
 */
export function buildStorageObjectPath(input) {
  const ext = extensionForMime(input.mimeType);
  if (!ext || !isUuid(input.userId) || !isUuid(input.subjectId)) {
    throw new StorageGrantError("Invalid storage path.", 400);
  }
  const objectId = input.objectId ?? crypto.randomUUID();
  if (!isUuid(objectId)) {
    throw new StorageGrantError("Invalid storage path.", 400);
  }
  if (input.bucket === STORAGE_BUCKETS.orderFiles) {
    if (!ORDER_FILE_PURPOSES.includes(input.purpose ?? "")) {
      throw new StorageGrantError("This file purpose is not available.", 400);
    }
    return `${input.subjectId}/${input.purpose}/${input.userId}/${objectId}.${ext}`;
  }
  if (input.bucket === STORAGE_BUCKETS.requestInspirations) {
    return `${input.userId}/${input.subjectId}/${objectId}.${ext}`;
  }
  return `${input.subjectId}/${input.userId}/${objectId}.${ext}`;
}

/** @param {string} path @param {string} bucket */
export function isSafeObjectPath(path, bucket) {
  if (
    typeof path !== "string" ||
    path.length > 240 ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    !SAFE_PATH_RE.test(path)
  ) {
    return false;
  }
  const config = BUCKET_CONFIG[bucket];
  if (!config) return false;
  const parts = path.split("/");
  if (config.purposes) return parts.length === 4;
  return parts.length === 3;
}

/**
 * @param {Uint8Array | ArrayBuffer | Buffer} input
 * @param {string} mimeType
 */
export function stripImageExif(input, mimeType) {
  const bytes = toBytes(input);
  if (mimeType === "image/jpeg") return stripJpegExif(bytes);
  if (mimeType === "image/png") return stripPngMetadata(bytes);
  if (mimeType === "image/webp") return stripWebpMetadata(bytes);
  return bytes;
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'marketplace' | 'studio' | 'admin'} audience
 */
export async function handleStorageRequest(request, supabase, audience) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const user = await requireUser(supabase);
    if (isNextResponse(user)) return user;
    return handleInspirationUpload(request, supabase, audience, user.id);
  }

  const user =
    audience === "admin"
      ? await requireAdminAal2(supabase)
      : await requireUser(supabase);
  if (isNextResponse(user)) return user;

  const body = await readJsonBody(request, 4_000);
  if (isNextResponse(body)) return body;
  const payload = body && typeof body === "object" ? body : {};
  try {
    if (payload.action === "sign-download") {
      return await signDownload(supabase, audience, payload);
    }
    if (payload.action !== "sign-upload") {
      throw new StorageGrantError("Unknown storage action.", 400);
    }
    return await signUpload(supabase, audience, user.id, payload);
  } catch (error) {
    return storageHttpError(error);
  }
}

function storageHttpError(error) {
  if (error instanceof StorageGrantError) {
    return jsonError(error.message, error.status, error.code);
  }
  return routeGuardError(error, "Unable to prepare the upload.");
}

async function signUpload(supabase, audience, userId, payload) {
  const grant = createUploadGrant({
    audience,
    userId,
    bucket: String(payload.bucket ?? ""),
    subjectId: String(payload.subjectId ?? ""),
    purpose: payload.purpose == null ? null : String(payload.purpose),
    mimeType: String(payload.mimeType ?? ""),
    byteSize: Number(payload.byteSize),
  });
  await assertUploadSubject(supabase, audience, userId, grant);
  const signed = await supabase.storage
    .from(grant.bucket)
    .createSignedUploadUrl(grant.path);
  if (signed.error || !signed.data) {
    throw new StorageGrantError(
      "This upload is not available.",
      403,
      "forbidden",
    );
  }
  return NextResponse.json({
    bucket: grant.bucket,
    path: grant.path,
    token: signed.data.token,
    signedUrl: signed.data.signedUrl,
  });
}

async function signDownload(supabase, audience, payload) {
  const grant = createDownloadGrant({
    audience,
    bucket: String(payload.bucket ?? ""),
    path: String(payload.path ?? ""),
  });
  if (grant.bucket === STORAGE_BUCKETS.portfolioImages) {
    const publicUrl = supabase.storage
      .from(grant.bucket)
      .getPublicUrl(grant.path);
    return NextResponse.json({
      bucket: grant.bucket,
      path: grant.path,
      signedUrl: publicUrl.data.publicUrl,
    });
  }
  const signed = await supabase.storage
    .from(grant.bucket)
    .createSignedUrl(grant.path, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new StorageGrantError(
      "This file is not available.",
      404,
      "not_found",
    );
  }
  return NextResponse.json({
    bucket: grant.bucket,
    path: grant.path,
    signedUrl: signed.data.signedUrl,
  });
}

async function handleInspirationUpload(request, supabase, audience, userId) {
  if (audience !== "marketplace") {
    return jsonError("This upload is not available.", 403, "forbidden");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > IMAGE_MAX_BYTES + 1024 * 1024
  ) {
    return jsonError("Images must be under 10 MB.", 413, "payload_too_large");
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const requestId = String(form.get("requestId") ?? "");
    if (!(file instanceof File) || file.size === 0) {
      throw new StorageGrantError(
        "Choose a JPG, PNG or WebP image under 10 MB.",
        400,
      );
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new StorageGrantError(
        "Images must be under 10 MB.",
        413,
        "payload_too_large",
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectAllowedMime(bytes, file.type);
    if (!mimeType || mimeType === "application/pdf") {
      throw new StorageGrantError(
        "The file does not match a supported image format.",
        400,
        "unsupported_type",
      );
    }
    const { data: row } = await supabase
      .from("outfit_requests")
      .select("id")
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) {
      throw new StorageGrantError(
        "This file is not available.",
        404,
        "not_found",
      );
    }
    const path = buildStorageObjectPath({
      bucket: STORAGE_BUCKETS.requestInspirations,
      userId,
      subjectId: requestId,
      mimeType,
    });
    const stripped = stripImageExif(bytes, mimeType);
    const upload = await supabase.storage
      .from(STORAGE_BUCKETS.requestInspirations)
      .upload(path, stripped, { contentType: mimeType, upsert: false });
    if (upload.error) {
      throw new StorageGrantError(
        "Upload failed. Please try again.",
        403,
        "forbidden",
      );
    }
    return NextResponse.json({
      bucket: STORAGE_BUCKETS.requestInspirations,
      path,
    });
  } catch (error) {
    return storageHttpError(error);
  }
}

async function assertUploadSubject(supabase, audience, userId, grant) {
  if (grant.bucket === STORAGE_BUCKETS.portfolioImages) {
    const boutiqueId = grant.path.split("/")[0];
    const { data: membership } = await supabase
      .from("boutique_members")
      .select("boutique_id")
      .eq("boutique_id", boutiqueId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    const { data: boutique } = await supabase
      .from("boutiques")
      .select("status")
      .eq("id", boutiqueId)
      .maybeSingle();
    if (boutique?.status === "suspended" || boutique?.status === "rejected") {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    return;
  }
  if (grant.bucket === STORAGE_BUCKETS.orderFiles) {
    const { data: order } = await supabase
      .from("customer_orders")
      .select("id, customer_id, boutique_owner_id, status")
      .eq("id", grant.path.split("/")[0])
      .maybeSingle();
    if (!order || order.status === "cancelled") {
      throw new StorageGrantError(
        "This file is not available.",
        404,
        "not_found",
      );
    }
    if (grant.purpose === "customer" && order.customer_id !== userId) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    if (grant.purpose === "atelier" && order.boutique_owner_id !== userId) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    if (
      grant.purpose === "shared" &&
      order.customer_id !== userId &&
      order.boutique_owner_id !== userId
    ) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    if (audience === "studio" && order.boutique_owner_id !== userId) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
    return;
  }
  if (grant.bucket === STORAGE_BUCKETS.verificationDocuments) {
    const { data } = await supabase
      .from("boutiques")
      .select("id")
      .eq("id", grant.path.split("/")[0])
      .eq("owner_id", userId)
      .maybeSingle();
    if (!data) {
      throw new StorageGrantError(
        "This upload is not available.",
        403,
        "forbidden",
      );
    }
  }
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function stripJpegExif(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new StorageGrantError(
      "The file does not match a supported image format.",
      400,
      "unsupported_type",
    );
  }
  const kept = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      kept.push(bytes.subarray(i));
      break;
    }
    while (i < bytes.length && bytes[i] === 0xff) i += 1;
    if (i >= bytes.length) break;
    const marker = bytes[i];
    i += 1;
    if (marker === 0xd9) {
      kept.push(Uint8Array.of(0xff, 0xd9));
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      kept.push(Uint8Array.of(0xff, marker));
      continue;
    }
    if (i + 1 >= bytes.length) {
      throw new StorageGrantError(
        "The file does not match a supported image format.",
        400,
        "unsupported_type",
      );
    }
    const length = (bytes[i] << 8) | bytes[i + 1];
    if (length < 2 || i + length > bytes.length) {
      throw new StorageGrantError(
        "The file does not match a supported image format.",
        400,
        "unsupported_type",
      );
    }
    if (marker === 0xda) {
      kept.push(Uint8Array.of(0xff, marker));
      kept.push(bytes.subarray(i));
      break;
    }
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) {
      kept.push(Uint8Array.of(0xff, marker));
      kept.push(bytes.subarray(i, i + length));
    }
    i += length;
  }
  return concatBytes(kept);
}

function stripPngMetadata(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24 ||
    signature.some((value, index) => bytes[index] !== value)
  ) {
    throw new StorageGrantError(
      "The file does not match a supported image format.",
      400,
      "unsupported_type",
    );
  }
  const skip = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const kept = [bytes.subarray(0, 8)];
  let i = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (i + 12 <= bytes.length) {
    const length = view.getUint32(i);
    const type = ascii(bytes, i + 4, 4);
    const total = 12 + length;
    if (i + total > bytes.length) {
      throw new StorageGrantError(
        "The file does not match a supported image format.",
        400,
        "unsupported_type",
      );
    }
    if (!skip.has(type)) kept.push(bytes.subarray(i, i + total));
    i += total;
    if (type === "IEND") break;
  }
  return concatBytes(kept);
}

function stripWebpMetadata(bytes) {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new StorageGrantError(
      "The file does not match a supported image format.",
      400,
      "unsupported_type",
    );
  }
  const kept = [];
  let i = 12;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (i + 8 <= bytes.length) {
    const fourcc = ascii(bytes, i, 4);
    const size = view.getUint32(i + 4, true);
    const padded = size + (size % 2);
    if (i + 8 + padded > bytes.length) {
      throw new StorageGrantError(
        "The file does not match a supported image format.",
        400,
        "unsupported_type",
      );
    }
    if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      const chunk = bytes.slice(i, i + 8 + padded);
      if (fourcc === "VP8X" && size >= 1) chunk[8] = chunk[8] & ~0x08 & ~0x04;
      kept.push(chunk);
    }
    i += 8 + padded;
  }
  const payload = concatBytes([asciiBytes("WEBP"), ...kept]);
  const header = new Uint8Array(8);
  header.set(asciiBytes("RIFF"));
  new DataView(header.buffer).setUint32(4, payload.byteLength, true);
  return concatBytes([header, payload]);
}

function asciiBytes(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}
