import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";
import { testStudio } from "./test-studio-workflow.mjs";
const env = getLocalSupabaseEnvironment(),
  url = requireLocalValue(env, "API_URL");
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
  "Local fixture testing only",
);
class DisabledRealtimeTransport {}
const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: DisabledRealtimeTransport },
};
const admin = createClient(
  url,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  opts,
);
async function login(email, password) {
  const jar = new Map();
  const client = createServerClient(
    url,
    requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY"),
    {
      ...opts,
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)),
      },
    },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(error, null);
  return {
    id: data.user.id,
    client,
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}
const owner = await login("owner@faden.local", "FadenOwner!2026"),
  customer = await login("customer@faden.local", "FadenCustomer!2026"),
  other = await login("admin@faden.local", "FadenAdmin!2026");
async function insert(table, row) {
  const r = await admin.from(table).insert(row).select().single();
  assert.equal(r.error, null);
  return r.data;
}
async function page(port, path, who) {
  const r = await fetch(`http://localhost:${port}${path}`, {
    redirect: "manual",
    headers: who ? { Cookie: who.cookie } : {},
  });
  return { status: r.status, text: await r.text() };
}
let b, request, share;
try {
  b = await insert("boutiques", {
    owner_id: owner.id,
    name: "Temporary Studio fixture",
    slug: `studio-test-${crypto.randomUUID()}`,
    status: "verified",
    is_published: true,
  });
  request = await insert("outfit_requests", {
    user_id: customer.id,
    status: "submitted",
    draft: { notes: "PRIVATE NEVER SHARED" },
  });
  share = await insert("request_shares", {
    request_id: request.id,
    customer_id: customer.id,
    boutique_id: b.id,
    client_label: "Local design fixture",
    brief: { occasion: "Wedding" },
  });
  await testStudio({ admin, owner, customer, other, b, page });
} finally {
  if (share) await admin.from("request_shares").delete().eq("id", share.id);
  if (request)
    await admin.from("outfit_requests").delete().eq("id", request.id);
  if (b) await admin.from("boutiques").delete().eq("id", b.id);
}
