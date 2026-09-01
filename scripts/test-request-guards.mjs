import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireAdminAal2,
  requireSameOrigin,
  requireUser,
} from "../packages/server/src/request-guards.mjs";

const require = createRequire(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../packages/server/package.json",
  ),
);
const { NextRequest } = require("next/server");

function mutationRequest({
  origin = "http://localhost:3000",
  url = "http://localhost:3000/api/example",
  body = "{}",
  includeOrigin = true,
} = {}) {
  const headers = new Headers();
  if (includeOrigin && origin) headers.set("origin", origin);
  return new NextRequest(url, {
    method: "POST",
    headers,
    body,
  });
}

test("jsonError returns a stable error payload", async () => {
  const response = jsonError("Please sign in.", 401, "unauthenticated");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Please sign in.",
    code: "unauthenticated",
  });
});

test("requireSameOrigin rejects missing and foreign origins", async () => {
  assert.equal(
    requireSameOrigin(mutationRequest({ includeOrigin: false }))?.status,
    403,
  );
  assert.equal(
    requireSameOrigin(
      mutationRequest({
        origin: "http://evil.example",
        url: "http://localhost:3000/api/example",
      }),
    )?.status,
    403,
  );
  assert.equal(requireSameOrigin(mutationRequest()), null);
});

test("requireUser rejects missing sessions", async () => {
  const response = await requireUser({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  });
  assert.equal(isNextResponse(response), true);
  if (isNextResponse(response)) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Please sign in.",
      code: "unauthenticated",
    });
  }
});

test("requireAdminAal2 rejects non-admin and AAL1 sessions", async () => {
  const customer = await requireAdminAal2({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal2" },
          error: null,
        }),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "customer" },
            error: null,
          }),
        }),
      }),
    }),
  });
  assert.equal(isNextResponse(customer), true);
  if (isNextResponse(customer)) {
    assert.equal(customer.status, 403);
    assert.deepEqual(await customer.json(), {
      error: "Administrator access required.",
      code: "forbidden",
    });
  }

  const aal1 = await requireAdminAal2({
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-1" } },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1" },
          error: null,
        }),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "admin" },
            error: null,
          }),
        }),
      }),
    }),
  });
  assert.equal(isNextResponse(aal1), true);
  if (isNextResponse(aal1)) {
    assert.equal(aal1.status, 403);
    assert.deepEqual(await aal1.json(), {
      error: "Administrator MFA verification required.",
      code: "aal2_required",
    });
  }
});

test("readJsonBody rejects oversized and invalid JSON payloads", async () => {
  const oversized = await readJsonBody(
    mutationRequest({ body: "x".repeat(9) }),
    8,
  );
  assert.equal(isNextResponse(oversized), true);
  if (isNextResponse(oversized)) {
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), {
      error: "Request too large.",
      code: "payload_too_large",
    });
  }

  const invalid = await readJsonBody(
    mutationRequest({ body: "{not-json" }),
    100,
  );
  assert.equal(isNextResponse(invalid), true);
  if (isNextResponse(invalid)) {
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {
      error: "Invalid JSON request.",
      code: "invalid_json",
    });
  }

  const parsed = await readJsonBody(
    mutationRequest({ body: '{"ok":true}' }),
    100,
  );
  assert.deepEqual(parsed, { ok: true });
});
