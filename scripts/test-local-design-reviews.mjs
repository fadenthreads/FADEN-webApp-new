import assert from "node:assert/strict";
import { testProduction } from "./test-production-workflow.mjs";
import { testAppointments } from "./test-appointment-workflow.mjs";
import { testFulfilment } from "./test-fulfilment-workflow.mjs";
import { testMessaging } from "./test-message-workflow.mjs";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";
const env = getLocalSupabaseEnvironment(),
  api = requireLocalValue(env, "API_URL");
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(api).hostname),
  "Local fixtures only",
);
class DisabledRealtimeTransport {}
const options = {
  // Isolate HTTP connections after deliberately rejected binary uploads.
  global: {
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Connection", "close");
      return fetch(url, { ...init, headers });
    },
  },
  realtime: { transport: DisabledRealtimeTransport },
  auth: { persistSession: false, autoRefreshToken: false },
};
const admin = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  options,
);
const anon = createClient(
  api,
  requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY"),
  options,
);
async function login(email, password) {
  const jar = new Map();
  const client = createServerClient(
    api,
    requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY"),
    {
      ...options,
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
    client,
    id: data.user.id,
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}
const customer = await login("customer@faden.local", "FadenCustomer!2026"),
  owner = await login("owner@faden.local", "FadenOwner!2026"),
  other = await login("admin@faden.local", "FadenAdmin!2026");
let checks = 0;
function ok(v, label) {
  assert.ok(v, label);
  checks++;
}
async function insert(table, body) {
  const { data, error } = await admin
    .from(table)
    .insert(body)
    .select()
    .single();
  assert.equal(error, null);
  return data;
}
async function post(port, who, body, origin = `http://localhost:${port}`) {
  const r = await fetch(`http://localhost:${port}/api/design-reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(who ? { Cookie: who.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function page(port, path, who) {
  const r = await fetch(`http://localhost:${port}${path}`, {
    redirect: "manual",
    headers: who ? { Cookie: who.cookie } : {},
  });
  return { status: r.status, text: await r.text() };
}
let b, request, share, offer, order;
const paths = [],
  reviewIds = [];
try {
  b = await insert("boutiques", {
    owner_id: owner.id,
    name: "Temporary design review atelier",
    slug: `review-test-${crypto.randomUUID()}`,
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
  const quote = {
    title: "Local design review gown",
    items: [
      {
        label: "Silk tailoring",
        detail: "Fixture",
        quantity: 1,
        unit_paise: 10000,
      },
    ],
    tax_bps: 0,
    advance_paise: 5000,
    delivery_date: new Date(Date.now() + 40 * 86400000)
      .toISOString()
      .slice(0, 10),
    expires_on: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    terms: "Fixture terms",
  };
  const sent = await owner.client.rpc("save_boutique_offer", {
    target_share: share.id,
    expected_version: 0,
    proposal: quote,
    send_now: true,
  });
  assert.equal(sent.error, null);
  offer = (
    await admin.from("boutique_offers").select().eq("id", sent.data).single()
  ).data;
  const accepted = await customer.client.rpc("accept_boutique_offer", {
    target_offer: offer.id,
    expected_version: offer.version,
    confirmed: true,
  });
  assert.equal(accepted.error, null);
  order = (
    await admin
      .from("customer_orders")
      .select()
      .eq("id", accepted.data)
      .single()
  ).data;
  ok(
    (await page(3000, `/orders/${order.id}/approval`, customer)).text.includes(
      "No design submitted yet",
    ),
    "empty private review renders",
  );
  ok(
    (await page(3000, `/orders/${order.id}/approval`, other)).status === 404,
    "other customer cannot load review",
  );
  const path = `${order.id}/${crypto.randomUUID()}.jpg`,
    bytes = readFileSync("apps/marketplace/public/stitch-assets/asset-061.jpg");
  paths.push(path);
  // Small valid PNG for denied writes: Kong may leave an unread large request
  // body on its upstream keep-alive connection when Storage rejects it early.
  const deniedImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3sAAAAASUVORK5CYII=",
    "base64",
  );
  ok(
    !!(
      await customer.client.storage
        .from("order-designs")
        .upload(path, deniedImage, { contentType: "image/png" })
    ).error,
    "customer cannot upload atelier sketch",
  );
  const upload = await owner.client.storage
    .from("order-designs")
    .upload(path, bytes, { contentType: "image/jpeg" });
  ok(
    !upload.error,
    `original owner uploads private sketch: ${upload.error?.message ?? "ok"}`,
  );
  ok(
    !!(
      await customer.client.storage
        .from("order-designs")
        .createSignedUrl(path, 60)
    ).error,
    "unpublished sketch hidden from customer",
  );
  const proposal = {
    title: "Silk gown review",
    note: "A softer drape and an ivory silk finish for your review.",
    fabric: "Ivory silk",
    detailing: "Gold thread",
    inspiration: "Architectural curves",
    sketch_path: path,
  };
  const publish = { orderId: order.id, revision: 0, proposal };
  ok(
    (await post(3001, null, publish)).status === 401,
    "anonymous publish requires sign-in",
  );
  ok(
    (await post(3001, owner, publish, "https://other.example")).status === 403,
    "cross-origin publication rejected",
  );
  ok(
    (await post(3001, customer, publish)).status !== 200,
    "customer cannot publish",
  );
  ok(
    (
      await post(3001, owner, {
        ...publish,
        proposal: {
          ...proposal,
          sketch_path: `${crypto.randomUUID()}/fake.jpg`,
        },
      })
    ).status !== 200,
    "cross-order image reference rejected",
  );
  const published = await post(3001, owner, publish);
  assert.equal(published.status, 200, JSON.stringify(published.data));
  const id = published.data.id;
  reviewIds.push(id);
  const retry = await post(3001, owner, publish);
  ok(retry.data.id === id, "same publication retries idempotently");
  ok(
    (
      await post(3001, owner, {
        ...publish,
        revision: 1,
        proposal: { ...proposal, title: "Premature new version" },
      })
    ).status !== 200,
    "pending version cannot be superseded",
  );
  ok(
    (await customer.client.from("order_design_reviews").select().eq("id", id))
      .data.length === 1,
    "customer can read own review",
  );
  ok(
    (await other.client.from("order_design_reviews").select().eq("id", id)).data
      .length === 0,
    "other users cannot read review",
  );
  ok(
    !!(await anon.from("order_design_reviews").select()).error,
    "anonymous table read denied",
  );
  ok(
    !!(
      await customer.client
        .from("order_design_reviews")
        .update({ status: "approved" })
        .eq("id", id)
    ).error,
    "direct decision forgery blocked",
  );
  ok(
    !!(
      await owner.client
        .from("order_design_reviews")
        .update({ title: "Rewritten" })
        .eq("id", id)
    ).error,
    "published content immutable",
  );
  const signed = await customer.client.storage
    .from("order-designs")
    .createSignedUrl(path, 60);
  ok(!signed.error, "customer can access published sketch");
  ok(
    (await fetch(signed.data.signedUrl)).status === 200,
    "signed sketch URL loads",
  );
  ok(
    !!(
      await other.client.storage.from("order-designs").createSignedUrl(path, 60)
    ).error,
    "outsider sketch access denied",
  );
  ok(
    !!(
      await owner.client.storage
        .from("order-designs")
        .update(path, deniedImage, { contentType: "image/png" })
    ).error,
    "owner cannot replace published sketch",
  );
  await owner.client.storage.from("order-designs").remove([path]);
  ok(
    !(
      await customer.client.storage
        .from("order-designs")
        .createSignedUrl(path, 60)
    ).error,
    "owner cannot delete published sketch",
  );
  const decision = {
    reviewId: id,
    decision: "changes_requested",
    feedback: "Please soften the neckline.",
    confirmed: true,
  };
  ok(
    (await post(3000, owner, decision)).status !== 200,
    "boutique cannot approve as customer",
  );
  ok(
    (await post(3000, customer, decision, "https://other.example")).status ===
      403,
    "cross-origin decision rejected",
  );
  ok(
    (await post(3000, customer, { ...decision, confirmed: false })).status !==
      200,
    "explicit decision consent required",
  );
  ok(
    (await post(3000, customer, { ...decision, feedback: "short" })).status !==
      200,
    "change request requires meaningful feedback",
  );
  ok(
    (await post(3000, customer, decision)).status === 200,
    "customer requests revision",
  );
  ok(
    (await post(3000, customer, decision)).status === 200,
    "decision retry idempotent",
  );
  const next = await post(3001, owner, {
    ...publish,
    revision: 1,
    proposal: {
      ...proposal,
      note: "The neckline is now softer, matching your requested changes.",
    },
  });
  assert.equal(next.status, 200, JSON.stringify(next.data));
  reviewIds.push(next.data.id);
  ok(
    (await post(3000, customer, { ...decision, decision: "approved" }))
      .status !== 200,
    "stale version cannot be approved",
  );
  const competing = await Promise.all(
    ["approved", "changes_requested"].map((d) =>
      post(3000, customer, {
        reviewId: next.data.id,
        decision: d,
        feedback: "Confirmed customer decision.",
        confirmed: true,
      }),
    ),
  );
  ok(
    competing.filter((r) => r.status === 200).length === 1,
    "competing decisions have one winner",
  );
  const rows = (
    await customer.client
      .from("order_design_reviews")
      .select()
      .eq("order_id", order.id)
      .order("revision")
  ).data;
  ok(
    rows.length === 2 && rows[0].feedback === decision.feedback,
    "prior version and feedback preserved",
  );
  const current = (
    await customer.client
      .from("customer_orders")
      .select()
      .eq("id", order.id)
      .single()
  ).data;
  ok(
    current.status === "awaiting_payment" &&
      current.total_paise === order.total_paise,
    "design decision does not change order or payment",
  );
  ok(
    (
      await admin
        .from("order_payment_attempts")
        .select()
        .eq("order_id", order.id)
    ).data.length === 0,
    "no payment attempt created",
  );
  const approval = await page(3000, `/orders/${order.id}/approval`, customer);
  ok(
    approval.status === 200 && approval.text.includes(proposal.title),
    "populated customer design page renders",
  );
  ok(
    !approval.text.includes("PRIVATE NEVER SHARED"),
    "private brief not copied into design page",
  );
  const journey = await page(3000, `/journey/${order.id}`, customer);
  ok(
    journey.status === 200 && journey.text.includes("Not started"),
    "journey does not fabricate production progress",
  );
  ok(
    (await page(3001, `/orders/${order.id}/design`, owner)).status === 200,
    "Studio design history renders",
  );
  ok(
    (await page(3001, `/orders/${order.id}/design`, other)).status === 404,
    "other atelier cannot load design editor",
  );
  await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
  ok(
    (
      await owner.client
        .from("order_design_reviews")
        .select()
        .eq("order_id", order.id)
    ).data.length === 0,
    "former owner loses review access",
  );
  ok(
    (
      await other.client
        .from("order_design_reviews")
        .select()
        .eq("order_id", order.id)
    ).data.length === 0,
    "new owner does not inherit private reviews",
  );
  await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
  await testProduction({ admin, owner, customer, other, order, b, page });
  await testAppointments({ admin, owner, customer, other, order, b, page });
  await testFulfilment({ admin, owner, customer, other, order, b, page });
  await testMessaging({ admin, owner, customer, other, order, b, page });
  const cancelled = await customer.client.rpc("cancel_unpaid_order", {
    target_order: order.id,
    confirmed: true,
  });
  assert.equal(cancelled.error, null);
  ok(
    (
      await post(3000, customer, {
        reviewId: next.data.id,
        decision: "approved",
        feedback: "",
        confirmed: true,
      })
    ).status !== 200,
    "cancelled order rejects decisions",
  );
  ok(
    (await post(3001, owner, { ...publish, revision: 2 })).status !== 200,
    "cancelled order rejects new versions",
  );
  ok(
    (await page(3000, `/orders/${order.id}/approval`, customer)).text.includes(
      "read-only",
    ),
    "cancelled review history remains read-only",
  );
  const events = (
    await admin
      .from("outbox_events")
      .select("event_type")
      .in("aggregate_id", reviewIds)
  ).data;
  ok(
    events.filter((e) => e.event_type === "design.published").length === 2,
    "one publish event per version",
  );
  ok(
    events.filter(
      (e) =>
        e.event_type === "design.approved" ||
        e.event_type === "design.changes_requested",
    ).length === 2,
    "one decision event per version",
  );
  ok(
    (await page(3000, "/preview/design-approval")).text.includes(
      "fictional preview",
    ),
    "sample screen clearly identified",
  );
  console.log(
    `Passed ${checks} design review, storage, privacy and journey checks.`,
  );
} finally {
  if (paths.length) await admin.storage.from("order-designs").remove(paths);
  if (reviewIds.length) {
    await admin.from("outbox_events").delete().in("aggregate_id", reviewIds);
    await admin.from("audit_events").delete().in("entity_id", reviewIds);
  }
  if (order) {
    await admin.from("order_design_reviews").delete().eq("order_id", order.id);
    await admin.from("outbox_events").delete().eq("aggregate_id", order.id);
    await admin.from("audit_events").delete().eq("entity_id", order.id);
    const r = await admin.from("customer_orders").delete().eq("id", order.id);
    assert.equal(r.error, null);
  }
  if (request) {
    await admin.from("outfit_requests").delete().eq("id", request.id);
  }
  if (b) {
    const r = await admin.from("boutiques").delete().eq("id", b.id);
    assert.equal(r.error, null);
  }
}
