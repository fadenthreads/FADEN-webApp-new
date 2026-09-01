import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@faden/supabase";
import type { NextRequest } from "next/server";

export type AuditAction =
  | "profile.role.changed"
  | "boutique.application.created"
  | "boutique.status.changed"
  | "boutique.verification.decision"
  | "refund.initiated"
  | "refund.completed"
  | "dispute.opened"
  | "dispute.updated"
  | "dispute.resolved"
  | "platform.config.changed"
  | "payout.marked"
  | "settlement.created"
  | "membership.changed"
  | "audit.exported";

export interface AuditRecordInput {
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
  ipHash?: string | null;
  userAgentSummary?: string | null;
}

export interface AuditRecordResult {
  ok: true;
  id: number;
}

export interface AuditRecordFailure {
  ok: false;
  code: "audit_invalid_input" | "audit_write_failed";
}

export interface RecordAuditEventOptions {
  strict?: boolean;
  request?: NextRequest | null;
  requestMetadata?: {
    requestId?: string | null;
    ipHash?: string | null;
    userAgentSummary?: string | null;
  } | null;
}

export declare const AUDIT_ACTIONS: {
  readonly PROFILE_ROLE_CHANGED: "profile.role.changed";
  readonly BOUTIQUE_APPLICATION_CREATED: "boutique.application.created";
  readonly BOUTIQUE_STATUS_CHANGED: "boutique.status.changed";
  readonly BOUTIQUE_VERIFICATION_DECISION: "boutique.verification.decision";
  readonly REFUND_INITIATED: "refund.initiated";
  readonly REFUND_COMPLETED: "refund.completed";
  readonly DISPUTE_OPENED: "dispute.opened";
  readonly DISPUTE_UPDATED: "dispute.updated";
  readonly DISPUTE_RESOLVED: "dispute.resolved";
  readonly PLATFORM_CONFIG_CHANGED: "platform.config.changed";
  readonly PAYOUT_MARKED: "payout.marked";
  readonly SETTLEMENT_CREATED: "settlement.created";
  readonly MEMBERSHIP_CHANGED: "membership.changed";
  readonly AUDIT_EXPORTED: "audit.exported";
};

export declare const PLATFORM_ADMIN_AUDIT_ACTIONS: readonly AuditAction[];
export declare const WORKFLOW_AUDIT_ACTIONS: readonly string[];

export declare class AuditRecordError extends Error {
  code: string;
  constructor(code: string);
}

export declare function recordAuditEvent(
  supabase: SupabaseClient<Database>,
  input: AuditRecordInput,
  options?: RecordAuditEventOptions,
): Promise<AuditRecordResult | AuditRecordFailure>;

export declare function isPlatformAdminAuditAction(action: string): boolean;

export declare const MAX_AUDIT_JSON_BYTES: number;
export declare const MAX_ENTITY_ID_LENGTH: number;
export declare const MAX_REQUEST_ID_LENGTH: number;
export declare const MAX_USER_AGENT_SUMMARY_LENGTH: number;

export declare function sanitizeAuditPayload(
  input: unknown,
): Record<string, unknown> | null;

export declare function normalizeRequestId(input: string): string | null;

export declare function summarizeUserAgent(input: string): string | null;

export declare function hashIpAddress(
  ip: string,
  secret: string,
): string | null;

export declare function extractClientIp(
  headers: Headers | { get(name: string): string | null | undefined },
): string | null;

export declare function extractRequestMetadata(
  request: NextRequest,
  options?: { ipHashSecret?: string; requestId?: string },
): {
  requestId: string | null;
  ipHash: string | null;
  userAgentSummary: string | null;
};

export declare function normalizeAuditRecordInput(
  input: AuditRecordInput,
): Required<
  Pick<
    AuditRecordInput,
    | "action"
    | "entityType"
    | "entityId"
    | "reason"
    | "requestId"
    | "ipHash"
    | "userAgentSummary"
  >
> & {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
