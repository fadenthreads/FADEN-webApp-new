import assert from "node:assert/strict";
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
const realtime = { transport: DisabledRealtimeTransport };
const admin = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  {
    realtime,
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
async function login(email, password) {
  const jar = new Map();
  const client = createServerClient(
    api,
    requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY"),
    {
      realtime,
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
  outsider = await login("admin@faden.local", "FadenAdmin!2026");
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
}
const date = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const quote = {
  title: "Temporary order test · silk ensemble",
  items: [
    {
      label: "Silk tailoring",
      detail: "Fixture",
      quantity: 2,
      unit_paise: 125050,
    },
  ],
  tax_bps: 500,
  advance_paise: 50000,
  delivery_date: date(40),
  expires_on: date(7),
  terms: "Includes two fittings. Fixture only.",
};
async function insert(table, body) {
  const { data, error } = await admin
    .from(table)
    .insert(body)
    .select()
    .single();
  assert.equal(error, null);
  return data;
}
const requests = [],
  boutiques = [],
  orderIds = [];
async function fixture() {
  const request = await insert("outfit_requests", {
    user_id: customer.id,
    status: "submitted",
    draft: {
      occasion: "Wedding",
      garment: "Lehenga",
      notes: "PRIVATE ORIGINAL",
      measurements: { chest: "90" },
    },
  });
  requests.push(request.id);
  const offers = [];
  for (const boutique of boutiques) {
    const share = await insert("request_shares", {
      request_id: request.id,
      customer_id: customer.id,
      boutique_id: boutique.id,
      client_label: "Local test customer",
      brief: { occasion: "Wedding" },
    });
    const { data, error } = await owner.client.rpc("save_boutique_offer", {
      target_share: share.id,
      expected_version: 0,
      proposal: quote,
      send_now: true,
    });
    assert.equal(error, null);
    const { data: offer, error: readError } = await admin
      .from("boutique_offers")
      .select()
      .eq("id", data)
      .single();
    assert.equal(readError, null);
    offers.push(offer);
  }
  return { request, offers };
}
async function call(
  offer,
  { who = customer, origin = "http://localhost:3000", body = {} } = {},
) {
  const response = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(who ? { Cookie: who.cookie } : {}),
    },
    body: JSON.stringify({
      action: "accept",
      offerId: offer.id,
      version: offer.version,
      confirmed: true,
      ...body,
    }),
  });
  return { status: response.status, data: await response.json() };
}
async function page(path, who = customer, studio = false) {
  const r = await fetch(`http://localhost:${studio ? 3001 : 3000}${path}`, {
    headers: who ? { Cookie: who.cookie } : {},
    redirect: "manual",
  });
  return { status: r.status, text: await r.text() };
}
async function updateOffer(id, patch) {
  const { error } = await admin
    .from("boutique_offers")
    .update(patch)
    .eq("id", id);
  assert.equal(error, null);
}
try {
  for (let i = 0; i < 2; i++)
    boutiques.push(
      await insert("boutiques", {
        owner_id: owner.id,
        slug: `order-test-${crypto.randomUUID()}`,
        name: `Temporary order atelier ${i}`,
        status: "verified",
        is_published: true,
      }),
    );
  const f = await fixture(),
    o = f.offers[0];
  check(
    (await call(o, { who: null })).status !== 200,
    "Anonymous acceptance rejected",
  );
  check(
    (await call(o, { origin: "https://other.example" })).status !== 200,
    "Cross-origin acceptance rejected",
  );
  check(
    (await call(o, { who: owner })).status !== 200,
    "Boutique cannot accept customer's offer",
  );
  check(
    (await call(o, { who: outsider })).status !== 200,
    "Other customer cannot accept",
  );
  check(
    (await call(o, { body: { confirmed: false } })).status !== 200,
    "Explicit consent required",
  );
  check(
    (await call(o, { body: { version: o.version + 1 } })).status !== 200,
    "Stale offer rejected",
  );
  await updateOffer(o.id, { quote: { ...quote, expires_on: date(-1) } });
  check((await call(o)).status !== 200, "Expired offer rejected");
  await updateOffer(o.id, { quote: { ...quote, delivery_date: date(-1) } });
  check((await call(o)).status !== 200, "Past completion date rejected");
  await updateOffer(o.id, { quote });
  await admin
    .from("boutiques")
    .update({ is_published: false })
    .eq("id", boutiques[0].id);
  check((await call(o)).status !== 200, "Unavailable boutique rejected");
  await admin
    .from("boutiques")
    .update({ is_published: true })
    .eq("id", boutiques[0].id);
  const accepted = await Promise.all([
    call(o, { body: { total_paise: 1, advance_paise: 0, status: "paid" } }),
    call(o),
  ]);
  check(
    accepted.every((r) => r.status === 200),
    "Concurrent duplicate acceptance succeeds idempotently",
  );
  check(
    accepted[0].data.id === accepted[1].data.id,
    "Duplicate calls return same order",
  );
  const orderId = accepted[0].data.id;
  orderIds.push(orderId);
  const { data: order, error } = await customer.client
    .from("customer_orders")
    .select()
    .eq("id", orderId)
    .single();
  assert.equal(error, null);
  check(
    order.total_paise === 262605 && order.advance_paise === 50000,
    "Prices come from stored quote, not browser",
  );
  check(
    order.status === "awaiting_payment" && order.currency === "INR",
    "Acceptance never implies paid",
  );
  check(
    !("measurements" in order.quote) && !("draft" in order),
    "Order snapshot excludes private brief",
  );
  check(
    (await call(f.offers[1])).status !== 200,
    "Second offer for same request rejected",
  );
  check(
    (
      await customer.client
        .from("customer_orders")
        .update({ status: "paid" })
        .eq("id", orderId)
    ).error,
    "Customer cannot mark paid",
  );
  check(
    (
      await owner.client
        .from("customer_orders")
        .update({ total_paise: 1 })
        .eq("id", orderId)
    ).error,
    "Boutique cannot alter snapshot",
  );
  check(
    (await outsider.client.from("customer_orders").select().eq("id", orderId))
      .data.length === 0,
    "Other user cannot read snapshot",
  );
  check(
    (await owner.client.from("customer_orders").select().eq("id", orderId)).data
      .length === 1,
    "Original verified owner can read order",
  );
  await admin
    .from("boutiques")
    .update({ is_published: false })
    .eq("id", boutiques[0].id);
  check(
    (await owner.client.from("customer_orders").select().eq("id", orderId)).data
      .length === 0,
    "Unpublished boutique loses order access",
  );
  await admin
    .from("boutiques")
    .update({ is_published: true, owner_id: outsider.id })
    .eq("id", boutiques[0].id);
  check(
    (await outsider.client.from("customer_orders").select().eq("id", orderId))
      .data.length === 0,
    "New boutique owner does not inherit commercial records",
  );
  check(
    (await owner.client.from("customer_orders").select().eq("id", orderId)).data
      .length === 0,
    "Former boutique owner loses order access",
  );
  await admin
    .from("boutiques")
    .update({ owner_id: owner.id })
    .eq("id", boutiques[0].id);
  const checkout = await page(`/orders/secure?id=${orderId}`);
  check(
    checkout.status === 200 &&
      checkout.text.includes("Secure your order") &&
      checkout.text.includes("test payments only"),
    "Real customer checkout renders test-only payment state",
  );
  check(
    (await page(`/orders/${orderId}`)).status === 200,
    "Customer order details render",
  );
  check(
    (await page(`/orders/${orderId}`, outsider)).status === 404,
    "Other customer order URL hidden",
  );
  check(
    (await page(`/orders/secure?id=${orderId}`, outsider)).status === 404,
    "Other customer checkout URL hidden",
  );
  check(
    (await page(`/orders/${orderId}`, owner, true)).status === 200,
    "Studio order detail renders for owner",
  );
  check(
    (await page(`/orders/${orderId}`, outsider, true)).status === 404,
    "Unrelated studio account denied",
  );
  check(
    (await page("/orders", null)).status === 307,
    "Unauthenticated order page redirects",
  );
  check(
    (
      await owner.client.rpc("close_boutique_offer", {
        target_offer: o.id,
        expected_version: o.version + 1,
        action: "withdrawn",
      })
    ).error,
    "Accepted offer cannot be withdrawn as a proposal",
  );
  const revoke = await customer.client.rpc("revoke_request_share", {
    target_share: o.share_id,
  });
  assert.equal(revoke.error, null);
  check(
    (await owner.client.from("request_shares").select().eq("id", o.share_id))
      .data.length === 0,
    "Revocation still hides brief",
  );
  check(
    (await owner.client.from("customer_orders").select().eq("id", orderId)).data
      .length === 1,
    "Commercial snapshot survives revocation",
  );
  check(
    (await call(o)).data.id === orderId,
    "Acceptance retry after revocation still returns existing order",
  );
  await updateOffer(o.id, {
    quote: { ...quote, title: "Changed by fixture administrator" },
  });
  check(
    (
      await customer.client
        .from("customer_orders")
        .select("quote")
        .eq("id", orderId)
        .single()
    ).data.quote.title === quote.title,
    "Order snapshot independent of source record",
  );
  const { data: events } = await admin
    .from("outbox_events")
    .select()
    .eq("event_type", "order.accepted")
    .eq("aggregate_id", orderId);
  check(
    events.length === 1 && Object.keys(events[0].payload).join() === "order_id",
    "One identifier-only outbox event despite retries",
  );
  const race = await fixture();
  const results = await Promise.all(race.offers.map((offer) => call(offer)));
  check(
    results.filter((r) => r.status === 200).length === 1,
    "Concurrent competing offers produce exactly one winner",
  );
  orderIds.push(results.find((r) => r.status === 200).data.id);
  check(
    (
      await admin
        .from("customer_orders")
        .select()
        .eq("request_id", race.request.id)
    ).data.length === 1,
    "Exactly one order persists for competing offers",
  );
  const revoked = await fixture();
  await customer.client.rpc("revoke_request_share", {
    target_share: revoked.offers[0].share_id,
  });
  check(
    (await call(revoked.offers[0])).status !== 200,
    "Revoked offer cannot be accepted",
  );
  const zero = await fixture();
  await updateOffer(zero.offers[0].id, {
    quote: { ...quote, advance_paise: 0 },
  });
  const zr = await call(zero.offers[0]);
  assert.equal(zr.status, 200);
  orderIds.push(zr.data.id);
  const zeroOrder = (
    await customer.client
      .from("customer_orders")
      .select()
      .eq("id", zr.data.id)
      .single()
  ).data;
  check(
    zeroOrder.status === "awaiting_payment" && zeroOrder.advance_paise === 0,
    "Zero advance does not bypass payment state",
  );
  async function commerce(
    path,
    body,
    who = customer,
    origin = "http://localhost:3000",
  ) {
    const response = await fetch("http://localhost:3000" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(who ? { Cookie: who.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  const cancel = { action: "cancel", orderId: zr.data.id, confirmed: true };
  check(
    (await commerce("/api/orders", cancel, outsider)).status !== 200,
    "Other customer cannot cancel",
  );
  check(
    (await commerce("/api/orders", { ...cancel, confirmed: false })).status !==
      200,
    "Cancellation needs consent",
  );
  check(
    (await commerce("/api/orders", cancel)).status === 200,
    "Cancel unpaid order through API",
  );
  check(
    (await commerce("/api/orders", cancel)).status === 200,
    "Cancellation is idempotent",
  );
  check(
    (await page(`/orders/${zr.data.id}`)).text.includes("Cancelled"),
    "Cancelled state renders",
  );
  const payFixture = await fixture();
  const payAccepted = await call(payFixture.offers[0]);
  assert.equal(payAccepted.status, 200);
  const payOrder = payAccepted.data.id;
  orderIds.push(payOrder);
  const start = { action: "start", orderId: payOrder, confirmed: true };
  check(
    (await commerce("/api/payments", start, null)).status !== 200,
    "Payment API requires auth",
  );
  check(
    (await commerce("/api/payments", start, customer, "https://evil.example"))
      .status !== 200,
    "Payment API blocks cross-origin writes",
  );
  check(
    (await commerce("/api/payments", start, outsider)).status !== 200,
    "Payment API checks order ownership",
  );
  check(
    (await commerce("/api/payments", { ...start, confirmed: false })).status !==
      200,
    "Payment API requires checkout consent",
  );
  const reserveArgs = {
    target_order: payOrder,
    actor: customer.id,
    public_key_id: "rzp_test_fixture",
  };
  check(
    (await customer.client.rpc("reserve_test_payment", reserveArgs)).error,
    "Browser cannot call trusted reserve RPC",
  );
  const reserves = await Promise.all([
    admin.rpc("reserve_test_payment", reserveArgs),
    admin.rpc("reserve_test_payment", reserveArgs),
  ]);
  assert.ok(reserves.every((r) => !r.error));
  check(
    reserves.filter((r) => r.data.is_new).length === 1,
    "Concurrent starts authorize one provider creation",
  );
  check(
    reserves[0].data.id === reserves[1].data.id,
    "Concurrent starts reuse same attempt",
  );
  const attempt = reserves[0].data;
  check(
    (
      await commerce("/api/orders", {
        action: "cancel",
        orderId: payOrder,
        confirmed: true,
      })
    ).status !== 200,
    "Checkout reservation blocks cancellation",
  );
  check(
    (await page(`/orders/${payOrder}/receipt`)).status === 404,
    "No receipt before captured payment",
  );
  check(
    (
      await commerce("/api/payments", {
        action: "verify",
        orderId: payOrder,
        providerOrderId: "order_fake",
        paymentId: "pay_fake",
        signature: "0".repeat(64),
      })
    ).status !== 200,
    "Unverified callback cannot confirm a payment",
  );
  const gatewayOrder = "order_" + crypto.randomUUID().replaceAll("-", ""),
    gatewayPayment = "pay_" + crypto.randomUUID().replaceAll("-", "");
  assert.equal(
    (
      await admin.rpc("attach_test_gateway_order", {
        target_attempt: attempt.id,
        gateway_order: gatewayOrder,
        amount: attempt.amount_paise,
      })
    ).error,
    null,
  );
  const captureArgs = {
    target_attempt: attempt.id,
    gateway_order: gatewayOrder,
    gateway_payment: gatewayPayment,
    amount: attempt.amount_paise,
    payment_currency: "INR",
  };
  check(
    (await customer.client.rpc("record_test_capture", captureArgs)).error,
    "Browser cannot mark capture verified",
  );
  const captures = await Promise.all([
    admin.rpc("record_test_capture", captureArgs),
    admin.rpc("record_test_capture", captureArgs),
  ]);
  check(
    captures.every((r) => !r.error),
    "Duplicate verified capture is idempotent",
  );
  const receipt = await page(`/orders/${payOrder}/receipt`);
  check(
    receipt.status === 200 &&
      receipt.text.includes("Test payment receipt") &&
      receipt.text.includes("No real money collected"),
    "Receipt clearly identifies test payment",
  );
  check(
    (await page(`/orders/${payOrder}/receipt`, outsider)).status === 404,
    "Receipt hidden from unrelated customers",
  );
  check(
    (await page(`/orders/${payOrder}`, owner, true)).text.includes(
      "Test advance verified",
    ),
    "Studio does not confuse test payment with real payment",
  );
  check(
    (
      await admin
        .from("outbox_events")
        .select()
        .eq("aggregate_id", payOrder)
        .eq("event_type", "payment.test_captured")
    ).data.length === 1,
    "One capture event under concurrency",
  );
  const cancelRace = await fixture();
  const raceAccepted = await call(cancelRace.offers[0]);
  const raceOrder = raceAccepted.data.id;
  orderIds.push(raceOrder);
  const raced = await Promise.all([
    customer.client.rpc("cancel_unpaid_order", {
      target_order: raceOrder,
      confirmed: true,
    }),
    admin.rpc("reserve_test_payment", {
      target_order: raceOrder,
      actor: customer.id,
      public_key_id: "rzp_test_fixture",
    }),
  ]);
  check(
    raced.filter((r) => !r.error).length === 1,
    "Cancellation and checkout race has exactly one winner",
  );
  const hook = await commerce("/api/payments/webhook", {
    event: "payment.captured",
  });
  check(
    [401, 503].includes(hook.status),
    "Unsigned webhook cannot record payment",
  );
  if (process.argv.includes("--gateway-smoke")) {
    const liveFixture = await fixture();
    const chosen = await call(liveFixture.offers[0]);
    assert.equal(chosen.status, 200);
    const smokeOrder = chosen.data.id;
    orderIds.push(smokeOrder);
    const started = await commerce("/api/payments", {
      action: "start",
      orderId: smokeOrder,
      confirmed: true,
      total_paise: 1,
    });
    assert.equal(started.status, 200, started.data.error);
    check(
      started.data.key.startsWith("rzp_test_") &&
        started.data.amount === quote.advance_paise,
      "Actual Razorpay test order uses saved advance",
    );
    const retry = await commerce("/api/payments", {
      action: "start",
      orderId: smokeOrder,
      confirmed: true,
    });
    assert.equal(retry.status, 200, retry.data.error);
    check(
      retry.data.order_id === started.data.order_id,
      "Actual Razorpay retry reuses provider order",
    );
    console.log(
      "Created one unpaid Razorpay TEST order for integration verification. No payment authorized/captured. Local fixtures will be removed; the unpaid provider test order remains in the Razorpay test dashboard.",
    );
  }
  console.log(`Passed ${checks} order/payment integration checks.`);
} finally {
  // Delete only isolated fixtures created by this test, in foreign-key order.
  if (requests.length) {
    const { data: rows } = await admin
      .from("customer_orders")
      .select("id")
      .in("request_id", requests);
    for (const r of rows ?? [])
      if (!orderIds.includes(r.id)) orderIds.push(r.id);
    const { data: offerRows } = await admin
      .from("boutique_offers")
      .select("id")
      .in("request_id", requests);
    const ids = [
      ...orderIds,
      ...(offerRows ?? []).map((r) => r.id),
      ...requests,
    ];
    if (ids.length)
      await admin.from("outbox_events").delete().in("aggregate_id", ids);
    if (orderIds.length)
      await admin
        .from("order_payment_attempts")
        .delete()
        .in("order_id", orderIds);
    await admin.from("customer_orders").delete().in("request_id", requests);
    const { error } = await admin
      .from("outfit_requests")
      .delete()
      .in("id", requests);
    assert.equal(error, null);
  }
  if (boutiques.length) {
    const { error } = await admin
      .from("boutiques")
      .delete()
      .in(
        "id",
        boutiques.map((b) => b.id),
      );
    assert.equal(error, null);
  }
}
