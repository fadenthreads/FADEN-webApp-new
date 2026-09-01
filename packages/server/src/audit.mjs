import { PLATFORM_ADMIN_AUDIT_ACTIONS } from "./audit-actions.mjs";
import {
  extractRequestMetadata,
  normalizeAuditRecordInput,
} from "./audit-sanitize.mjs";

export class AuditRecordError extends Error {
  constructor(code) {
    super(code);
    this.name = "AuditRecordError";
    this.code = code;
  }
}

/**
 * Financial and platform-admin mutations must fail when audit logging fails.
 * Non-critical telemetry may use strict=false and inspect the returned result.
 */
export async function recordAuditEvent(
  supabase,
  input,
  { strict = true, request = null, requestMetadata = null } = {},
) {
  const normalized = normalizeAuditRecordInput({
    ...input,
    ...(requestMetadata ?? (request ? extractRequestMetadata(request) : {})),
  });

  if (!normalized.action || !normalized.entityType) {
    if (strict) throw new AuditRecordError("audit_invalid_input");
    return { ok: false, code: "audit_invalid_input" };
  }

  try {
    const { data, error } = await supabase.rpc("record_audit_event", {
      p_action: normalized.action,
      p_entity_type: normalized.entityType,
      p_entity_id: normalized.entityId,
      p_reason: normalized.reason,
      p_before: normalized.before,
      p_after: normalized.after,
      p_request_id: normalized.requestId,
      p_ip_hash: normalized.ipHash,
      p_user_agent_summary: normalized.userAgentSummary,
    });

    if (error) {
      if (strict) throw new AuditRecordError("audit_write_failed");
      return { ok: false, code: "audit_write_failed" };
    }

    return { ok: true, id: data };
  } catch {
    if (strict) throw new AuditRecordError("audit_write_failed");
    return { ok: false, code: "audit_write_failed" };
  }
}

export function isPlatformAdminAuditAction(action) {
  return PLATFORM_ADMIN_AUDIT_ACTIONS.includes(action);
}

export {
  AUDIT_ACTIONS,
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  WORKFLOW_AUDIT_ACTIONS,
} from "./audit-actions.mjs";
export {
  extractClientIp,
  extractRequestMetadata,
  hashIpAddress,
  MAX_AUDIT_JSON_BYTES,
  MAX_ENTITY_ID_LENGTH,
  MAX_REQUEST_ID_LENGTH,
  MAX_USER_AGENT_SUMMARY_LENGTH,
  normalizeAuditRecordInput,
  normalizeRequestId,
  sanitizeAuditPayload,
  summarizeUserAgent,
} from "./audit-sanitize.mjs";
