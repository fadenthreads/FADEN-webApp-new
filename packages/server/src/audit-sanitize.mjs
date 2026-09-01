import { createHmac } from "node:crypto";

const ALLOWED_KEYS = new Set([
  "id",
  "status",
  "role",
  "action",
  "type",
  "version",
  "reason",
  "boutique_id",
  "order_id",
  "user_id",
  "entity_id",
  "share_id",
  "offer_id",
  "from_status",
  "to_status",
  "policy_basis",
  "decision",
  "slug",
  "name",
  "subtotal_paise",
  "tax_paise",
  "total_paise",
  "advance_paise",
  "amount_paise",
  "currency",
  "count",
  "enabled",
  "key",
  "scope",
]);

const BLOCKED_KEY_PATTERN =
  /password|passwd|otp|token|secret|cookie|authorization|api[_-]?key|refresh[_-]?token|access[_-]?token|signed[_-]?url|card|cvv|pan|measurement|address|phone|email_body|provider_payload|razorpay|webhook_secret|bank_account|ifsc|account_number/i;

const BLOCKED_VALUE_PATTERN =
  /password|passwd|otp|token|secret|cookie|authorization|bearer\s|api[_-]?key|refresh[_-]?token|access[_-]?token|signed[_-]?url|card|cvv|pan|measurement|provider_payload|razorpay|webhook_secret|bank_account|ifsc|account_number/i;

export const MAX_AUDIT_STRING = 256;
export const MAX_AUDIT_JSON_BYTES = 8192;
export const MAX_REQUEST_ID_LENGTH = 64;
export const MAX_USER_AGENT_SUMMARY_LENGTH = 120;
export const MAX_REASON_LENGTH = 500;
export const MAX_ACTION_LENGTH = 120;
export const MAX_ENTITY_TYPE_LENGTH = 80;
export const MAX_ENTITY_ID_LENGTH = 128;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeScalar(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || BLOCKED_VALUE_PATTERN.test(trimmed)) return null;
    return trimmed.length > MAX_AUDIT_STRING
      ? trimmed.slice(0, MAX_AUDIT_STRING)
      : trimmed;
  }
  return null;
}

/**
 * Allowlist-based sanitizer for audit before/after payloads.
 * Returns null when nothing safe remains.
 */
export function sanitizeAuditPayload(input) {
  if (input === null || input === undefined) return null;
  if (!isPlainObject(input)) return null;

  try {
    if (
      Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_AUDIT_JSON_BYTES
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const result = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = String(rawKey).trim().toLowerCase();
    if (
      !ALLOWED_KEYS.has(key) ||
      key.length > 64 ||
      BLOCKED_KEY_PATTERN.test(key)
    ) {
      continue;
    }
    const value = sanitizeScalar(rawValue);
    if (value !== null) {
      result[key] = value;
    }
  }

  if (Object.keys(result).length === 0) return null;

  const encoded = JSON.stringify(result);
  if (Buffer.byteLength(encoded, "utf8") > MAX_AUDIT_JSON_BYTES) {
    return null;
  }
  return result;
}

export function normalizeRequestId(input) {
  if (typeof input !== "string") return null;
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, MAX_REQUEST_ID_LENGTH);
  return normalized || null;
}

export function summarizeUserAgent(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  let family = "unknown";
  if (/Edg\//i.test(trimmed)) family = "edge";
  else if (/Chrome\//i.test(trimmed) && !/Chromium/i.test(trimmed))
    family = "chrome";
  else if (/Firefox\//i.test(trimmed)) family = "firefox";
  else if (/Safari\//i.test(trimmed) && !/Chrome/i.test(trimmed))
    family = "safari";

  let os = "unknown";
  if (/Windows NT/i.test(trimmed)) os = "windows";
  else if (/Mac OS X|Macintosh/i.test(trimmed)) os = "macos";
  else if (/Android/i.test(trimmed)) os = "android";
  else if (/iPhone|iPad|iOS/i.test(trimmed)) os = "ios";
  else if (/Linux/i.test(trimmed)) os = "linux";

  const summary = `${family}/${os}`;
  return summary.slice(0, MAX_USER_AGENT_SUMMARY_LENGTH);
}

function normalizeIpAddress(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;

  const withoutPort = value.startsWith("[")
    ? value.replace(/^\[([^[\]]+)\].*$/, "$1")
    : value.includes(":") && value.includes(".")
      ? value.split(":")[0]
      : value;

  if (/^[\da-f:.]+$/i.test(withoutPort)) {
    return withoutPort.toLowerCase();
  }
  return null;
}

export function hashIpAddress(ip, secret) {
  const normalized = normalizeIpAddress(ip);
  if (!normalized || typeof secret !== "string" || !secret.trim()) {
    return null;
  }
  return createHmac("sha256", secret.trim()).update(normalized).digest("hex");
}

export function extractClientIp(headers) {
  if (!headers) return null;
  const forwarded = headers.get?.("x-forwarded-for");
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  const realIp = headers.get?.("x-real-ip");
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return null;
}

export function extractRequestMetadata(request, options = {}) {
  const headers = request?.headers;
  const secret =
    options.ipHashSecret ?? process.env.FADEN_AUDIT_IP_HASH_SECRET ?? "";
  const requestId =
    normalizeRequestId(
      headers?.get?.("x-request-id") ??
        headers?.get?.("x-correlation-id") ??
        options.requestId ??
        "",
    ) ?? null;

  return {
    requestId,
    ipHash: hashIpAddress(extractClientIp(headers), secret),
    userAgentSummary: summarizeUserAgent(headers?.get?.("user-agent") ?? ""),
  };
}

export function normalizeAuditRecordInput(input) {
  const action =
    typeof input.action === "string"
      ? input.action.trim().slice(0, MAX_ACTION_LENGTH)
      : "";
  const entityType =
    typeof input.entityType === "string"
      ? input.entityType.trim().slice(0, MAX_ENTITY_TYPE_LENGTH)
      : "";
  const entityId =
    typeof input.entityId === "string"
      ? input.entityId.trim().slice(0, MAX_ENTITY_ID_LENGTH) || null
      : (input.entityId ?? null);
  const reason =
    typeof input.reason === "string"
      ? input.reason.trim().slice(0, MAX_REASON_LENGTH) || null
      : (input.reason ?? null);

  return {
    action,
    entityType,
    entityId,
    reason,
    before: sanitizeAuditPayload(input.before ?? null),
    after: sanitizeAuditPayload(input.after ?? null),
    requestId: normalizeRequestId(input.requestId ?? ""),
    ipHash:
      typeof input.ipHash === "string"
        ? input.ipHash.trim().slice(0, 128) || null
        : null,
    userAgentSummary: summarizeUserAgent(input.userAgentSummary ?? ""),
  };
}
