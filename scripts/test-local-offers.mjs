import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";
const env = getLocalSupabaseEnvironment();
const api = requireLocalValue(env, "API_URL");
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(api).hostname),
  "Local Supabase only",
);
class DisabledRealtimeTransport {}
const realtime = { transport: DisabledRealtimeTransport };
const key = requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY");
const admin = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  { realtime, auth: { persistSession: false, autoRefreshToken: false } },
);
async function signIn(email, password) {
  const jar = new Map();
  const client = createServerClient(api, key, {
    realtime,
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(error, null);
  return {
    client,
    id: data.user.id,
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}
const customer = await signIn("customer@faden.local", "FadenCustomer!2026"),
  owner = await signIn("owner@faden.local", "FadenOwner!2026"),
  outsider = await signIn("admin@faden.local", "FadenAdmin!2026");
async function call(
  path,
  body,
  { studio = false, who = customer, method = "POST", origin } = {},
) {
  const base = `http://localhost:${studio ? 3001 : 3000}`;
  const multipart = body instanceof FormData;
  const r = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      Origin: origin ?? base,
      ...(who ? { Cookie: who.cookie } : {}),
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const t = await r.text();
  let data;
  try {
    data = JSON.parse(t);
  } catch {
    data = t;
  }
  return { status: r.status, data };
}
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
const requests = [],
  shares = [],
  offers = [],
  objects = [];
const date = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
// Existing Aarya onboarding stays pending. Use an isolated verified test atelier.
const { data: boutique, error: boutiqueError } = await admin
  .from("boutiques")
  .insert({
    owner_id: owner.id,
    slug: `offer-test-${crypto.randomUUID()}`,
    name: "Temporary offer test atelier",
    status: "verified",
    is_published: true,
  })
  .select("id")
  .single();
assert.equal(boutiqueError, null);
assert.ok(boutique);
const quote = {
  title: "Local test · bespoke silk ensemble",
  items: [
    {
      label: "Silk & tailoring",
      detail: "Fixture only",
      quantity: 2,
      unit_paise: 125050,
    },
  ],
  tax_bps: 500,
  advance_paise: 50000,
  delivery_date: date(40),
  expires_on: date(7),
  terms: "Includes two fittings; delivery included. Local test only.",
};
async function createRequest() {
  let r = await call("/api/requests", {});
  assert.equal(r.status, 200);
  let row = r.data;
  requests.push(row.id);
  r = await call(
    `/api/requests/${row.id}`,
    {
      version: row.version,
      draft: {
        occasion: "Wedding",
        garment: "Lehenga",
        notes: "Local fixture brief",
        expert: true,
        measurementMethod: "manual",
        measurements: {
          unit: "cm",
          chest: "90",
          waist: "70",
          hips: "95",
          height: "",
        },
        budget: "25k_50k",
        deliveryDate: date(45),
        eventDate: date(60),
        consent: true,
      },
    },
    { method: "PATCH" },
  );
  assert.equal(r.status, 200);
  return r.data;
}
try {
  let row = await createRequest();
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
  let r = await call(`/api/requests/${row.id}/inspiration`, form);
  assert.equal(r.status, 200);
  row = r.data.row;
  objects.push(r.data.key);
  assert.equal(
    (await call(`/api/requests/${row.id}/submit`, { version: row.version }))
      .status,
    200,
  );
  const shareBody = {
    action: "share",
    requestId: row.id,
    boutiqueId: boutique.id,
    measurements: false,
    inspiration: false,
    confirmed: true,
  };
  check(
    (await call("/api/shares", { ...shareBody, confirmed: false })).status ===
      400,
    "Sharing requires confirmation",
  );
  check(
    (await call("/api/shares", shareBody, { who: outsider })).status === 400,
    "Other customer cannot share",
  );
  const crossOriginShare = await call("/api/shares", shareBody, {
    origin: "https://untrusted.invalid",
  });
  check(
    crossOriginShare.status === 403 &&
      crossOriginShare.data?.code === "invalid_origin",
    "Cross-origin sharing denied",
  );
  r = await call("/api/shares", shareBody);
  check(r.status === 200 && r.data.id, "Customer shares brief");
  const share = r.data.id;
  shares.push(share);
  check(
    (await call("/api/shares", shareBody)).data.id === share,
    "Sharing retry is idempotent",
  );
  const { data: snapshot } = await owner.client
    .from("request_shares")
    .select("brief")
    .eq("id", share)
    .single();
  check(
    snapshot && !snapshot.brief.measurements && !snapshot.brief.inspirations,
    "Unapproved measurements/images withheld",
  );
  check(
    (
      await owner.client.storage
        .from("request-inspirations")
        .createSignedUrl(objects[0], 60)
    ).error,
    "Unapproved image signing denied",
  );
  const detail = await call(`/requests/${share}`, undefined, {
    studio: true,
    who: owner,
    method: "GET",
  });
  check(
    detail.status === 200 &&
      detail.data.includes("Customer Vision") &&
      !detail.data.includes('"chest":"90"'),
    "Studio renders consented brief",
  );
  check(
    (
      await call(`/requests/${share}`, undefined, {
        studio: true,
        who: outsider,
        method: "GET",
      })
    ).status === 404,
    "Other atelier cannot render brief",
  );
  check(
    (
      await call(
        "/api/offers",
        { action: "notes", shareId: share, notes: "SECRET INTERNAL NOTE" },
        { studio: true, who: owner },
      )
    ).status === 200,
    "Owner saves internal notes",
  );
  check(
    (
      await customer.client
        .from("atelier_request_notes")
        .select()
        .eq("share_id", share)
    ).data.length === 0,
    "Customer cannot read internal notes",
  );
  const body = {
    action: "save",
    shareId: share,
    version: 0,
    quote,
    send: false,
  };
  check(
    (await call("/api/offers", body, { studio: true, who: customer }))
      .status === 400,
    "Customer cannot issue quote",
  );
  const crossOriginOffer = await call("/api/offers", body, {
    studio: true,
    who: owner,
    origin: "https://untrusted.invalid",
  });
  check(
    crossOriginOffer.status === 403 &&
      crossOriginOffer.data?.code === "invalid_origin",
    "Cross-origin offer denied",
  );
  r = await call("/api/offers", body, { studio: true, who: owner });
  check(r.status === 200, "Draft quote saved");
  const offer = r.data.id;
  offers.push(offer);
  check(
    (await call(`/offers/${offer}`, undefined, { method: "GET" })).status ===
      404,
    "Customer cannot render draft quote",
  );
  check(
    (await call("/api/offers", body, { studio: true, who: owner })).status ===
      400,
    "Stale quote update denied",
  );
  check(
    (
      await call(
        "/api/offers",
        { ...body, version: 1, quote: { ...quote, advance_paise: 999999999 } },
        { studio: true, who: owner },
      )
    ).status === 400,
    "Invalid advance denied",
  );
  const send = { ...body, version: 1, send: true };
  r = await call("/api/offers", send, { studio: true, who: owner });
  check(r.status === 200 && r.data.id === offer, "Owner sends quote");
  check(
    (await call("/api/offers", send, { studio: true, who: owner })).data.id ===
      offer,
    "Send retry is idempotent",
  );
  const { data: sent } = await customer.client
    .from("boutique_offers")
    .select()
    .eq("id", offer)
    .single();
  check(
    sent.total_paise === 262605 && sent.tax_paise === 12505,
    "Server calculated exact money",
  );
  const visible = await call(`/offers/${offer}`, undefined, { method: "GET" });
  check(
    visible.status === 200 &&
      visible.data.includes("Design Breakdown") &&
      !visible.data.includes("SECRET INTERNAL NOTE"),
    "Customer sees sent quote without private notes",
  );
  check(
    (
      await call(`/offers/compare?request=${row.id}`, undefined, {
        method: "GET",
      })
    ).status === 200,
    "Same-request comparison renders",
  );
  check(
    (
      await call(`/offers/${offer}`, undefined, {
        who: outsider,
        method: "GET",
      })
    ).status === 404,
    "Other customer cannot render quote",
  );
  check(
    (
      await call(
        "/api/offers",
        { action: "declined", offerId: offer, version: 2 },
        { who: outsider },
      )
    ).status === 400,
    "Other customer cannot decline",
  );
  check(
    (
      await call("/api/offers", {
        action: "declined",
        offerId: offer,
        version: 2,
      })
    ).status === 200,
    "Customer declines sent quote",
  );
  check(
    (await call("/api/shares", { action: "revoke", shareId: share })).status ===
      200,
    "Customer revokes invitation",
  );
  check(
    (
      await call(`/requests/${share}`, undefined, {
        studio: true,
        who: owner,
        method: "GET",
      })
    ).status === 404,
    "Revocation removes Studio access",
  );
  // Positive optional sharing and image access, followed by revocation.
  let second = await createRequest();
  const form2 = new FormData();
  form2.set("version", String(second.version));
  form2.set("file", form.get("file"));
  r = await call(`/api/requests/${second.id}/inspiration`, form2);
  assert.equal(r.status, 200);
  second = r.data.row;
  objects.push(r.data.key);
  assert.equal(
    (
      await call(`/api/requests/${second.id}/submit`, {
        version: second.version,
      })
    ).status,
    200,
  );
  r = await call("/api/shares", {
    ...shareBody,
    requestId: second.id,
    measurements: true,
    inspiration: true,
  });
  assert.equal(r.status, 200);
  const sharedAll = r.data.id;
  shares.push(sharedAll);
  const { data: full } = await owner.client
    .from("request_shares")
    .select("brief")
    .eq("id", sharedAll)
    .single();
  check(
    full.brief.measurements.chest === "90",
    "Explicit measurement consent honored",
  );
  check(
    (
      await owner.client.storage
        .from("request-inspirations")
        .createSignedUrl(objects[1], 60)
    ).data?.signedUrl,
    "Explicit image consent honored",
  );
  const q2 = await call(
    "/api/offers",
    { ...body, shareId: sharedAll, send: true },
    { studio: true, who: owner },
  );
  assert.equal(q2.status, 200);
  offers.push(q2.data.id);
  await call("/api/shares", { action: "revoke", shareId: sharedAll });
  check(
    (
      await owner.client.storage
        .from("request-inspirations")
        .createSignedUrl(objects[1], 60)
    ).error,
    "Revocation prevents new signed image links",
  );
  check(
    (
      await customer.client
        .from("boutique_offers")
        .select("status")
        .eq("id", q2.data.id)
        .single()
    ).data.status === "withdrawn",
    "Revocation withdraws outstanding offer",
  );
  const { data: events } = await admin
    .from("outbox_events")
    .select("id")
    .eq("event_type", "offer.sent")
    .eq("aggregate_id", offer);
  check(events.length === 1, "One send event despite retries");
  console.log(
    `${checks} offer/sharing/Studio/customer integration checks passed.`,
  );
} finally {
  if (objects.length) {
    const { error } = await admin.storage
      .from("request-inspirations")
      .remove(objects);
    assert.equal(error, null);
  }
  for (const id of [...requests, ...shares, ...offers]) {
    const { error } = await admin
      .from("outbox_events")
      .delete()
      .eq("aggregate_id", id)
      .in("event_type", [
        "request.shared",
        "offer.sent",
        "outfit_request.submitted",
      ]);
    assert.equal(error, null);
  }
  for (const id of requests) {
    const { error } = await admin
      .from("outfit_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", customer.id);
    assert.equal(error, null);
  }
  const { error: boutiqueCleanup } = await admin
    .from("boutiques")
    .delete()
    .eq("id", boutique.id)
    .eq("owner_id", owner.id);
  assert.equal(boutiqueCleanup, null);
}
