// One connected journey. Never run against hosted data or real providers.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

const env = getLocalSupabaseEnvironment();
const api = requireLocalValue(env, "API_URL");
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(api).hostname),
  "LOCAL ONLY",
);
const key = requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY");
class DisabledRealtimeTransport {}
const options = {
  realtime: { transport: DisabledRealtimeTransport },
  auth: { persistSession: false, autoRefreshToken: false },
};
// Privileged client is used only to bootstrap isolated identities/admin role
// and invoke the existing service-only TEST payment simulator. Business actions
// below use the same authenticated HTTP/RPC boundaries as the applications.
const service = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  options,
);
const anonymous = createClient(api, key, options);
const run = randomUUID().slice(0, 8);
const date = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  console.log(`PASS ${++checks}: ${label}`);
}
async function result(promise, label) {
  const response = await promise;
  assert.equal(
    response.error,
    null,
    `${label}: ${response.error?.message ?? ""}`,
  );
  return response.data;
}
async function identity(kind) {
  const email = `journey-${run}-${kind}@faden.local`;
  const password = `Isolated!${randomUUID()}`;
  const user = await result(
    service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `ISOLATED ${kind}` },
    }),
    "Create fixture identity",
  );
  const jar = new Map();
  const client = createServerClient(api, key, {
    ...options,
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach((cookie) => jar.set(cookie.name, cookie.value)),
    },
  });
  await result(
    client.auth.signInWithPassword({ email, password }),
    "Sign in fixture",
  );
  return {
    id: user.user.id,
    client,
    cookie: () =>
      [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}
async function post(port, path, who, body, method = "POST", expected = 200) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      Origin: `http://localhost:${port}`,
      ...(who ? { Cookie: who.cookie() } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} :${port}${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function page(port, path, who, expected = 200) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: who ? { Cookie: who.cookie() } : {},
  });
  assert.equal(response.status, expected, `Page :${port}${path}`);
  return response.text();
}
async function row(client, table, id) {
  return result(
    client.from(table).select().eq("id", id).single(),
    `Read ${table}`,
  );
}
function totp(secret) {
  const bits = [...secret.toUpperCase().replace(/=+$/u, "")]
    .map((char) =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        .indexOf(char)
        .toString(2)
        .padStart(5, "0"),
    )
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return String(
    (digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}

// CI owns and destroys this entire local database. Keep fixtures on failure for
// diagnosis; never delete hosted users or business records from this harness.
const owner = await identity("owner");
const customer = await identity("customer");
const admin = await identity("admin");
await result(
  service.from("profiles").update({ role: "admin" }).eq("id", admin.id),
  "Bootstrap test admin",
);
const slug = `isolated-journey-${run}`;
const name = `ISOLATED TEST Atelier ${run}`;
const boutiqueId = await result(
  owner.client.rpc("create_boutique_application", {
    boutique_name: name,
    boutique_slug: slug,
    boutique_city: "Hyderabad",
    boutique_description: "Automated isolated fixture. Not a real boutique.",
  }),
  "Register boutique through owner RPC",
);
check(
  (await row(owner.client, "boutiques", boutiqueId)).status ===
    "pending_verification",
  "New registration is pending, not pre-approved",
);
check(
  (
    await result(
      anonymous.from("boutiques").select("id").eq("id", boutiqueId),
      "Read public catalogue",
    )
  ).length === 0,
  "Unapproved boutique hidden from customers",
);
await page(3001, "/verification", owner);
const details = {
  legal_business_name: "ISOLATED TEST ONLY NOT A REAL BUSINESS",
  public_trading_name: name,
  business_type: "Private Limited",
  registration_number: `TEST-ONLY-${run}`,
  pan: "AAAAA1111A",
  registered_address_line1: "42 Fictional Test Street",
  city: "Hyderabad",
  state: "Telangana",
  postal_code: "500001",
  authorized_rep_name: "ISOLATED Owner",
  authorized_rep_role: "Test fixture",
  contact_email: `journey-${run}-owner@faden.local`,
  contact_phone: "+919876543210",
};
const application = await post(3001, "/api/verification", owner, {
  action: "create_draft",
  boutique_id: boutiqueId,
  details,
});
const submissionId = application.submission_id;
check(
  !!submissionId,
  "Newly registered owner can start verification without a status workaround",
);
const approval = {
  action: "approve",
  submission_id: submissionId,
  reason: "ISOLATED AUTOMATED FIXTURE ONLY, not genuine business approval.",
};
await post(3002, "/api/verification", admin, approval, "POST", 403);
check(true, "AAL1 admin cannot approve boutiques");
const factor = await result(
  admin.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Isolated journey ${run}`,
  }),
  "Enroll fixture MFA",
);
const challenge = await result(
  admin.client.auth.mfa.challenge({ factorId: factor.id }),
  "Challenge fixture MFA",
);
await result(
  admin.client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: totp(factor.totp.secret),
  }),
  "Verify fixture MFA",
);
await post(3002, "/api/verification", admin, approval, "POST", 409);
check(true, "AAL2 admin cannot approve an unsubmitted draft");
let submission = await row(
  owner.client,
  "boutique_verification_submissions",
  submissionId,
);
await post(
  3001,
  "/api/verification",
  owner,
  {
    action: "submit",
    submission_id: submissionId,
    version: submission.version,
  },
  "POST",
  400,
);
check(true, "Documents required before submission");
// Tiny synthetic image, explicitly named TEST-ONLY. Never forge or upload real
// PAN/business/address documents to test systems.
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3sAAAAASUVORK5CYII=",
  "base64",
);
for (const category of [
  "business_registration",
  "pan_document",
  "address_proof",
]) {
  const grant = await post(3001, "/api/storage", owner, {
    action: "sign-upload",
    bucket: "verification-documents",
    subjectId: boutiqueId,
    mimeType: "image/png",
    byteSize: bytes.length,
  });
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(grant.signedUrl).hostname),
    "Local upload only",
  );
  const upload = await fetch(grant.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(upload.ok, `Upload ${category}: ${upload.status}`);
  await post(3001, "/api/verification", owner, {
    action: "attach_document",
    submission_id: submissionId,
    category,
    storage_object_key: grant.path,
    file_name: `TEST-ONLY-${category}.png`,
    mime_type: "image/png",
    file_size_bytes: bytes.length,
  });
}
submission = await row(
  owner.client,
  "boutique_verification_submissions",
  submissionId,
);
await post(3001, "/api/verification", owner, {
  action: "submit",
  submission_id: submissionId,
  version: submission.version,
});
await page(3002, "/boutiques", admin);
await post(3002, "/api/verification", admin, approval);
const approved = await row(owner.client, "boutiques", boutiqueId);
check(
  approved.status === "verified" && approved.is_published,
  "Admin approval publishes the same boutique",
);
check(
  (
    await result(
      anonymous.from("boutiques").select("id").eq("id", boutiqueId),
      "Public approved boutique",
    )
  ).length === 1,
  "Approved boutique is discoverable under customer RLS",
);
await page(3000, `/boutiques/${slug}`, customer);

const request = await post(3000, "/api/requests", customer, { boutique: slug });
const saved = await post(
  3000,
  `/api/requests/${request.id}`,
  customer,
  {
    version: request.version,
    draft: {
      occasion: "Wedding",
      garment: "Lehenga",
      expert: true,
      notes: "ISOLATED FULL JOURNEY reference",
      measurementMethod: "later",
      budget: "25k_50k",
      eventDate: date(60),
      deliveryDate: date(40),
      consent: true,
    },
  },
  "PATCH",
);
await post(3000, `/api/requests/${request.id}/submit`, customer, {
  version: saved.version,
});
const share = await post(3000, "/api/shares", customer, {
  action: "share",
  requestId: request.id,
  boutiqueId,
  measurements: false,
  inspiration: false,
  confirmed: true,
});
check(
  (await page(3001, `/requests/${share.id}`, owner)).includes(
    "ISOLATED FULL JOURNEY",
  ),
  "Boutique sees the actual customer brief",
);
const offer = await post(3001, "/api/offers", owner, {
  action: "save",
  shareId: share.id,
  version: 0,
  send: true,
  quote: {
    title: "ISOLATED TEST silk ensemble",
    items: [
      {
        label: "Tailoring fixture",
        detail: "No real service",
        quantity: 1,
        unit_paise: 100000,
      },
    ],
    tax_bps: 0,
    advance_paise: 100000,
    delivery_date: date(40),
    expires_on: date(7),
    terms: "Isolated fixture. No real money or delivery.",
  },
});
const sentOffer = await row(owner.client, "boutique_offers", offer.id);
const accepted = await post(3000, "/api/orders", customer, {
  action: "accept",
  offerId: offer.id,
  version: sentOffer.version,
  confirmed: true,
});
const orderId = accepted.id;
check(!!orderId, "Customer accepts boutique quotation and creates order");
check(
  (
    await post(3000, "/api/orders", customer, {
      action: "accept",
      offerId: offer.id,
      version: sentOffer.version,
      confirmed: true,
    })
  ).id === orderId,
  "Acceptance retry does not duplicate the order",
);
await page(3000, `/orders/${orderId}`, customer);
await page(3001, `/orders/${orderId}`, owner);
await page(3002, `/orders/${orderId}`, admin);
await page(3000, `/orders/${orderId}/receipt`, customer, 404);
check(
  true,
  "Customer, boutique and admin can open the same order; no unpaid receipt",
);

const reserveArgs = {
  target_order: orderId,
  actor: customer.id,
  public_key_id: "rzp_test_isolated_journey",
};
check(
  !!(await customer.client.rpc("reserve_test_payment", reserveArgs)).error,
  "Customer cannot self-authorize captured payment",
);
const attempt = await result(
  service.rpc("reserve_test_payment", reserveArgs),
  "SIMULATE test payment reservation",
);
const providerOrder = `order_${randomUUID().replaceAll("-", "")}`;
const capture = {
  target_attempt: attempt.id,
  gateway_order: providerOrder,
  gateway_payment: `pay_${randomUUID().replaceAll("-", "")}`,
  amount: attempt.amount_paise,
  payment_currency: "INR",
};
await result(
  service.rpc("attach_test_gateway_order", {
    target_attempt: attempt.id,
    gateway_order: providerOrder,
    amount: attempt.amount_paise,
  }),
  "SIMULATE provider order",
);
await result(
  service.rpc("record_test_capture", capture),
  "SIMULATE capture; no Razorpay call",
);
await result(
  service.rpc("record_test_capture", capture),
  "Retry simulated capture",
);
check(
  (await page(3000, `/orders/${orderId}/receipt`, customer)).includes(
    "No real money collected",
  ),
  "SIMULATED payment creates clearly labelled test receipt",
);

const sketchPath = `${orderId}/${randomUUID()}.jpg`;
await result(
  owner.client.storage
    .from("order-designs")
    .upload(
      sketchPath,
      readFileSync("apps/marketplace/public/stitch-assets/asset-061.jpg"),
      { contentType: "image/jpeg" },
    ),
  "Owner uploads order sketch",
);
const design = await post(3001, "/api/design-reviews", owner, {
  orderId,
  revision: 0,
  proposal: {
    title: "ISOLATED silk design",
    note: "Please review the test neckline and fabric.",
    fabric: "Ivory silk",
    detailing: "Gold thread",
    inspiration: "Test only",
    sketch_path: sketchPath,
  },
});
const progress = (sequence, stage) => ({
  orderId,
  sequence,
  stage,
  commandId: randomUUID(),
  note: `ISOLATED production stage ${stage}`,
  photo: null,
  confirmed: true,
});
await post(3001, "/api/production", owner, progress(0, 1), "POST", 409);
check(true, "Production is blocked until customer design approval");
await post(3000, "/api/design-reviews", customer, {
  reviewId: design.id,
  decision: "approved",
  feedback: "ISOLATED customer approves test design.",
  confirmed: true,
});
for (let stage = 1; stage <= 5; stage++)
  await post(3001, "/api/production", owner, progress(stage - 1, stage));
check(true, "Boutique sends all five production updates on the same order");
await page(3000, `/journey/${orderId}`, customer);
await post(3000, "/api/fulfilment", customer, {
  action: "address",
  orderId,
  revision: 0,
  commandId: randomUUID(),
  confirmed: true,
  details: {
    recipient: "ISOLATED CUSTOMER",
    phone: "+919876543210",
    line1: "42 Fictional Test Street",
    line2: "NO REAL DELIVERY",
    city: "Hyderabad",
    state: "Telangana",
    postal_code: "500001",
    country: "IN",
  },
});
let version = 0;
const shipment = (status) => ({
  action: "shipment",
  order_id: orderId,
  expected_version: version,
  carrier_name: "ISOLATED SIMULATOR NO COURIER",
  tracking_number: `TEST-${run}`,
  tracking_url: null,
  status,
  admin_note: "PRIVATE TEST ONLY",
  confirm_delivered: status === "delivered",
});
await post(3002, "/api/orders", owner, shipment("booked"), "POST", 403);
check(true, "Boutique cannot perform admin shipping actions");
for (const status of [
  "booked",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
]) {
  const response = await post(3002, "/api/orders", admin, shipment(status));
  version = response.data.version;
  for (const who of [owner, customer]) {
    const visible = await result(
      who.client.rpc("read_order_manual_shipment", { p_order_id: orderId }),
      "Read tracking status",
    );
    check(
      visible.shipment?.status === status &&
        !JSON.stringify(visible).includes("PRIVATE TEST ONLY"),
      `${who === owner ? "Boutique" : "Customer"} sees ${status}, not admin-only notes`,
    );
  }
}
await page(3000, `/orders/${orderId}/complete`, customer);
await page(3000, `/orders/${orderId}/aftercare`, customer);
await post(3000, "/api/aftercare", customer, {
  action: "submit",
  orderId,
  kind: "review",
  rating: 5,
  note: "ISOLATED TEST review after simulated delivery.",
  commandId: randomUUID(),
  confirmed: true,
});
check(true, "Simulated delivery unlocks completion and customer review");
console.log(
  JSON.stringify({
    result: "PASS",
    checks,
    boutiqueId,
    requestId: request.id,
    offerId: offer.id,
    orderId,
    payment: "SIMULATED service-only test capture, no real money",
    delivery: "SIMULATED manual statuses, no courier",
    email: "Not dispatched; delivery not tested",
    scope:
      "Isolated local Supabase only; HTTP/server-render checks, not visual browser QA",
  }),
);
