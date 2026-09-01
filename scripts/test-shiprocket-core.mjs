import assert from "node:assert/strict";
import test from "node:test";
import {
  createShiprocketClient,
  getShiprocketReadiness,
  mapShiprocketStatus,
  normalizeParcel,
  normalizePostcode,
  shippingRequestKey,
  verifyShiprocketWebhookToken,
} from "../apps/studio/lib/shiprocket-core.mjs";

test("shipping remains disabled without configuration", () => {
  const state = getShiprocketReadiness({ NEXT_PUBLIC_APP_ENV: "preview" });
  assert.equal(state.configured, false);
  assert.equal(state.liveBookingEnabled, false);
});

test("live booking needs credentials, both flags and production", () => {
  const base = {
    SHIPROCKET_API_EMAIL: "api@example.com",
    SHIPROCKET_API_PASSWORD: "secret",
    SHIPROCKET_PICKUP_LOCATION: "FADEN",
    SHIPROCKET_PICKUP_POSTCODE: "110001",
    SHIPROCKET_WEBHOOK_SECRET: "webhook-secret",
    SHIPROCKET_API_ENABLED: "true",
    SHIPROCKET_LIVE_BOOKING_ENABLED: "true",
  };
  assert.equal(
    getShiprocketReadiness({ ...base, NEXT_PUBLIC_APP_ENV: "preview" })
      .liveBookingEnabled,
    false,
  );
  assert.equal(
    getShiprocketReadiness({ ...base, NEXT_PUBLIC_APP_ENV: "production" })
      .liveBookingEnabled,
    true,
  );
});

test("PIN and parcel validation reject unsafe values", () => {
  assert.equal(normalizePostcode("110001"), "110001");
  assert.throws(() => normalizePostcode("000000"));
  assert.deepEqual(
    normalizeParcel({ weight: 1.255, length: 30, breadth: 20, height: 10 }),
    {
      weight: 1.26,
      length: 30,
      breadth: 20,
      height: 10,
    },
  );
  assert.throws(() =>
    normalizeParcel({ weight: 0, length: 1, breadth: 1, height: 1 }),
  );
});

test("status mapping covers delivery and exception paths", () => {
  assert.equal(mapShiprocketStatus("OUT FOR DELIVERY"), "out_for_delivery");
  assert.equal(mapShiprocketStatus("Delivered"), "delivered");
  assert.equal(mapShiprocketStatus("Undelivered"), "exception");
  assert.equal(mapShiprocketStatus("RTO IN TRANSIT"), "rto");
});

test("webhook token uses an exact constant-time comparison", () => {
  assert.equal(verifyShiprocketWebhookToken("abc", "abc"), true);
  assert.equal(verifyShiprocketWebhookToken("abcd", "abc"), false);
  assert.equal(verifyShiprocketWebhookToken(null, "abc"), false);
});

test("idempotency keys are stable and operation-specific", () => {
  const first = shippingRequestKey("order", "create_order", 1);
  assert.equal(first, shippingRequestKey("order", "create_order", 1));
  assert.notEqual(first, shippingRequestKey("order", "assign_awb", 1));
});

test("client authenticates once and sends bearer token", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify(
        String(url).endsWith("/auth/login")
          ? { token: "access-token" }
          : { data: { available_courier_companies: [] } },
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const client = createShiprocketClient(
    {
      baseUrl: "https://example.test/v1/external",
      email: "api@example.test",
      password: "secret",
      pickupLocation: "FADEN",
      pickupPostcode: "110001",
      webhookSecret: "webhook-secret",
    },
    fetcher,
  );
  await client.serviceability({
    deliveryPostcode: "400001",
    parcel: { weight: 1, length: 30, breadth: 20, height: 10 },
  });
  await client.trackAwb("123456789");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].init.headers.Authorization, "Bearer access-token");
  assert.match(calls[1].url, /pickup_postcode=110001/);
});
