import assert from "node:assert/strict";
import test from "node:test";
import { checkSupabaseHealth } from "../packages/server/src/health.mjs";

test("health reports missing configuration without making a request", async () => {
  let called = false;
  const result = await checkSupabaseHealth({}, async () => {
    called = true;
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_configured");
  assert.equal(called, false);
});

test("health checks the Supabase REST database endpoint", async () => {
  const result = await checkSupabaseHealth(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
    },
    async (url, init) => {
      assert.equal(
        url,
        "https://example.supabase.co/rest/v1/boutiques?select=id&limit=1",
      );
      assert.equal(init.headers.apikey, "public-key");
      return { ok: true };
    },
  );
  assert.equal(result.ok, true);
});

test("health safely reports dependency failures", async () => {
  const result = await checkSupabaseHealth(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
    },
    async () => {
      throw new Error("secret internal error");
    },
  );
  assert.deepEqual(result.reason, "unavailable");
});
