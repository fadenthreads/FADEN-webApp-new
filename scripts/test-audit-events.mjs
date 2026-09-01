import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIT_ACTIONS,
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  WORKFLOW_AUDIT_ACTIONS,
  extractClientIp,
  extractRequestMetadata,
  hashIpAddress,
  isPlatformAdminAuditAction,
  normalizeAuditRecordInput,
  normalizeRequestId,
  sanitizeAuditPayload,
  summarizeUserAgent,
} from "../packages/server/src/audit.mjs";

test("sanitizeAuditPayload keeps allowlisted safe fields", () => {
  assert.deepEqual(
    sanitizeAuditPayload({
      status: "verified",
      role: "boutique_owner",
      total_paise: 250000,
    }),
    {
      status: "verified",
      role: "boutique_owner",
      total_paise: 250000,
    },
  );
});

test("sanitizeAuditPayload removes secrets and sensitive keys", () => {
  assert.deepEqual(
    sanitizeAuditPayload({
      status: "open",
      password: "hidden",
      access_token: "secret-value",
      api_key: "abc",
      measurement_profile: "ignored",
      address_line1: "ignored",
      phone: "+919999999999",
    }),
    { status: "open" },
  );
});

test("sanitizeAuditPayload drops blocked string values", () => {
  assert.equal(
    sanitizeAuditPayload({ reason: "token=super-secret-value" }),
    null,
  );
});

test("sanitizeAuditPayload enforces payload size limit", () => {
  const huge = sanitizeAuditPayload({
    reason: "x".repeat(9000),
    status: "open",
  });
  assert.equal(huge, null);
});

test("normalizeRequestId strips unsafe characters", () => {
  assert.equal(normalizeRequestId(" Req_ABC-123! "), "reqabc-123");
  assert.equal(normalizeRequestId("   "), null);
});

test("summarizeUserAgent returns stable browser/os families", () => {
  assert.equal(
    summarizeUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    ),
    "chrome/macos",
  );
  assert.equal(
    summarizeUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ),
    "firefox/windows",
  );
});

test("hashIpAddress is keyed and never returns raw input", () => {
  const hash = hashIpAddress("203.0.113.10", "local-test-secret");
  assert.ok(hash);
  assert.notEqual(hash, "203.0.113.10");
  assert.notEqual(hashIpAddress("203.0.113.10", "other-secret"), hash);
  assert.equal(hashIpAddress("203.0.113.10", ""), null);
});

test("extractRequestMetadata normalizes headers", () => {
  const headers = new Headers({
    "x-request-id": " req-001 ",
    "x-forwarded-for": "203.0.113.10, 198.51.100.2",
    "user-agent":
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
  });
  const metadata = extractRequestMetadata(
    { headers },
    { ipHashSecret: "local-test-secret" },
  );
  assert.equal(metadata.requestId, "req-001");
  assert.equal(metadata.userAgentSummary, "chrome/android");
  assert.equal(
    metadata.ipHash,
    hashIpAddress("203.0.113.10", "local-test-secret"),
  );
});

test("extractClientIp prefers the first forwarded address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 198.51.100.2",
  });
  assert.equal(extractClientIp(headers), "203.0.113.10");
});

test("normalizeAuditRecordInput truncates long identifiers", () => {
  const normalized = normalizeAuditRecordInput({
    action: "profile.role.changed",
    entityType: "profile",
    entityId: "x".repeat(200),
    reason: "y".repeat(600),
    before: { role: "customer", password: "nope" },
    after: { role: "admin" },
    requestId: "REQ!001",
  });
  assert.equal(normalized.entityId?.length, 128);
  assert.equal(normalized.reason?.length, 500);
  assert.deepEqual(normalized.before, { role: "customer" });
  assert.deepEqual(normalized.after, { role: "admin" });
  assert.equal(normalized.requestId, "req001");
});

test("platform admin action catalog covers future integrations", () => {
  assert.ok(
    PLATFORM_ADMIN_AUDIT_ACTIONS.includes(AUDIT_ACTIONS.REFUND_INITIATED),
  );
  assert.ok(WORKFLOW_AUDIT_ACTIONS.includes("design.published"));
  assert.equal(isPlatformAdminAuditAction(AUDIT_ACTIONS.DISPUTE_OPENED), true);
  assert.equal(
    isPlatformAdminAuditAction(AUDIT_ACTIONS.BOUTIQUE_APPLICATION_CREATED),
    false,
  );
});
