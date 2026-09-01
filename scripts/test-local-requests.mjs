import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

// Local-only integration fixtures. Never run against a hosted Supabase project.
const env = getLocalSupabaseEnvironment();
const api = requireLocalValue(env, "API_URL");
assert.ok(["127.0.0.1", "localhost"].includes(new URL(api).hostname));
const origin = "http://localhost:3000";
const key = requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY");
// Tests use HTTP only; keep the harness compatible with the local Node 20 runtime.
class DisabledRealtimeTransport {}
const realtime = { transport: DisabledRealtimeTransport };
const admin = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false }, realtime },
);
async function session(email, password) {
  const jar = new Map();
  const client = createServerClient(api, key, {
    realtime,
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(error, null, "Local fixture sign-in failed");
  return {
    client,
    user: data.user,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}
const customer = await session("customer@faden.local", "FadenCustomer!2026");
const other = await session("owner@faden.local", "FadenOwner!2026");
async function request(
  path,
  body,
  { who = customer, method = "POST", requestOrigin = origin } = {},
) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    headers: {
      Origin: requestOrigin,
      ...(who ? { Cookie: who.cookie } : {}),
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}
const ids = [],
  objects = [];
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}
try {
  check(
    (await request("/api/requests", {}, { who: null })).status >= 400,
    "Anonymous creation denied",
  );
  check(
    (
      await request(
        "/api/requests",
        {},
        { requestOrigin: "https://untrusted.invalid" },
      )
    ).status >= 400,
    "Cross-origin creation denied",
  );
  const { data: designs } = await customer.client
    .from("designs")
    .select("id,slug,boutique_id")
    .eq("status", "published")
    .limit(1);
  check(designs?.length === 1, "Catalog source exists");
  let result = await request("/api/requests", { design: designs[0].slug });
  check(
    result.status === 200 && result.data.id,
    `Create request (${result.status}: ${JSON.stringify(result.data)})`,
  );
  let row = result.data;
  ids.push(row.id);
  check(
    row.design_id === designs[0].id &&
      row.boutique_id === designs[0].boutique_id,
    "Source context retained",
  );
  const path = `/api/requests/${row.id}`;
  result = await request(
    path,
    {
      version: row.version,
      draft: { occasion: "Wedding", garment: "Lehenga" },
    },
    { method: "PATCH" },
  );
  check(
    result.status === 200 && result.data.version === row.version + 1,
    "Draft saved with incremented version",
  );
  check(
    (
      await request(
        path,
        { version: row.version, draft: {} },
        { method: "PATCH" },
      )
    ).status === 409,
    "Stale save rejected",
  );
  row = result.data;
  check(
    (await request(`${path}/submit`, { version: row.version })).status === 400,
    "Incomplete submission rejected",
  );
  check(
    (
      await request(
        path,
        { version: row.version, draft: row.draft },
        { method: "PATCH", who: other },
      )
    ).status === 409,
    "Other customer cannot edit",
  );
  check(
    (await request(`${path}/submit`, { version: row.version }, { who: other }))
      .status === 400,
    "Other customer cannot submit",
  );
  const badFile = new FormData();
  badFile.set("version", String(row.version));
  badFile.set(
    "file",
    new Blob(["not an image"], { type: "image/png" }),
    "fake.png",
  );
  check(
    (await request(`${path}/inspiration`, badFile)).status === 400,
    "MIME mismatch rejected",
  );
  check(
    !Array.isArray(row.draft?.inspirations) ||
      row.draft.inspirations.length === 0,
    "Failed upload did not persist an inspiration",
  );
  const form = new FormData();
  form.set("version", String(row.version));
  form.set(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "fixture.png",
  );
  result = await request(`${path}/inspiration`, form);
  check(
    result.status === 200 && result.data.url && result.data.key,
    "Private image uploaded and signed",
  );
  row = result.data.row;
  objects.push(result.data.key);
  check(
    row.draft.inspirations.some((item) => item.key === result.data.key) &&
      !JSON.stringify(row.draft).includes("token="),
    "Draft persists the object key, not a signed URL",
  );
  check((await fetch(result.data.url)).ok, "Signed image renders");
  check(
    (
      await fetch(
        `${api}/storage/v1/object/public/request-inspirations/${objects[0]}`,
      )
    ).status >= 400,
    "Image not publicly accessible",
  );
  check(
    (
      await other.client.storage
        .from("request-inspirations")
        .createSignedUrl(objects[0], 60)
    ).error,
    "Other user cannot sign private image",
  );
  check(
    (
      await request("/api/storage", {
        action: "remove",
        bucket: "request-inspirations",
        path: objects[0],
      })
    ).status === 409,
    "Referenced inspiration cannot be deleted",
  );
  check(
    (
      await request(
        path,
        {
          version: row.version,
          draft: {
            ...row.draft,
            inspirations: [
              { key: `${other.user.id}/${row.id}/foreign.png`, note: "" },
            ],
          },
        },
        { method: "PATCH" },
      )
    ).status === 400,
    "Foreign image ownership rejected",
  );
  const future = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const complete = {
    ...row.draft,
    notes: "Automated local request test",
    expert: true,
    measurementMethod: "later",
    deliveryDate: future(45),
    eventDate: future(60),
    budget: "25k_50k",
    consent: true,
  };
  result = await request(
    path,
    { version: row.version, draft: complete },
    { method: "PATCH" },
  );
  check(result.status === 200, "Complete draft saved");
  row = result.data;
  check(
    (await request(`${path}/submit`, { version: row.version - 1 })).status ===
      409,
    "Stale submission rejected",
  );
  result = await request(`${path}/submit`, { version: row.version });
  check(result.status === 200 && result.data.id === row.id, "Submit succeeds");
  result = await request(`${path}/submit`, { version: row.version });
  check(
    result.status === 200 && result.data.id === row.id,
    "Retry is idempotent",
  );
  check(
    (
      await request(
        path,
        { version: row.version + 1, draft: complete },
        { method: "PATCH" },
      )
    ).status === 409,
    "Submitted brief is locked",
  );
  const confirmation = await request(`/requests/${row.id}`, undefined, {
    method: "GET",
  });
  check(
    confirmation.status === 200 && confirmation.data.includes("Wedding"),
    "Owner sees confirmation",
  );
  const extra = await request("/api/requests", { design: designs[0].slug });
  check(extra.status === 200 && extra.data.id, "Cleanup fixture created");
  ids.push(extra.data.id);
  const extraForm = new FormData();
  extraForm.set("version", String(extra.data.version));
  extraForm.set("file", form.get("file"));
  const extraUpload = await request(
    `/api/requests/${extra.data.id}/inspiration`,
    extraForm,
  );
  check(extraUpload.status === 200, "Cleanup fixture uploaded");
  objects.push(extraUpload.data.key);
  const detached = await request(
    `/api/requests/${extra.data.id}`,
    {
      version: extraUpload.data.row.version,
      draft: { ...extraUpload.data.row.draft, inspirations: [] },
    },
    { method: "PATCH" },
  );
  check(detached.status === 200, "Inspiration detached before cleanup");
  check(
    (
      await request("/api/storage", {
        action: "remove",
        bucket: "request-inspirations",
        path: extraUpload.data.key,
      })
    ).status === 200,
    "Unreferenced inspiration object removed",
  );
  const denied = await request(`/requests/${row.id}`, undefined, {
    method: "GET",
    who: other,
  });
  check(
    denied.status === 404 &&
      !denied.data.includes("Automated local request test"),
    "Other user cannot read confirmation",
  );
  const { data: events } = await admin
    .from("outbox_events")
    .select("id,payload")
    .eq("aggregate_id", row.id)
    .eq("event_type", "outfit_request.submitted");
  check(
    events?.length === 1 &&
      Object.keys(events[0].payload).join() === "request_id",
    "One event, no private measurements in payload",
  );
  console.log(`${checks} request HTTP/auth/storage/submission checks passed.`);
} finally {
  // Remove only the exact objects and rows created by this test run.
  if (objects.length) {
    const { error } = await admin.storage
      .from("request-inspirations")
      .remove(objects);
    assert.equal(error, null);
  }
  for (const id of ids) {
    const events = await admin
      .from("outbox_events")
      .delete()
      .eq("aggregate_id", id)
      .eq("event_type", "outfit_request.submitted");
    assert.equal(events.error, null);
    const row = await admin
      .from("outfit_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", customer.user.id);
    assert.equal(row.error, null);
  }
}
