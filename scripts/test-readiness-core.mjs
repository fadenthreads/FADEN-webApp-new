import assert from "node:assert/strict";
import test from "node:test";
import {
  getDailyReadiness,
  getEmailReadiness,
  getLiveWorkflowsReadiness,
  getMapsReadiness,
  getPaymentsReadiness,
  getShippingReadiness,
  isPreviewMutationAllowed,
  toPublicReadiness,
} from "../packages/integrations/src/readiness.mjs";

const shiprocketBase = {
  SHIPROCKET_API_EMAIL: "api@example.com",
  SHIPROCKET_API_PASSWORD: "secret",
  SHIPROCKET_PICKUP_LOCATION: "FADEN",
  SHIPROCKET_PICKUP_POSTCODE: "110001",
  SHIPROCKET_WEBHOOK_SECRET: "webhook-secret",
  SHIPROCKET_API_ENABLED: "true",
  SHIPROCKET_LIVE_BOOKING_ENABLED: "true",
};

const dailyBase = {
  DAILY_API_KEY: "server-secret",
  DAILY_API_ENABLED: "true",
  DAILY_LIVE_ROOMS_ENABLED: "true",
};

const paymentsBase = {
  RAZORPAY_KEY_ID: "rzp_test_example",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
  RAZORPAY_PAYMENTS_ENABLED: "true",
};

test("readiness responses never include secret values", () => {
  const readiness = getPaymentsReadiness({
    ...paymentsBase,
    FADEN_ENABLE_LIVE_WORKFLOWS: "true",
  });
  assert.deepEqual(Object.keys(readiness).sort(), [
    "configured",
    "enabled",
    "live",
    "missing",
    "provider",
  ]);
  assert.equal(JSON.stringify(readiness).includes("secret"), false);
  assert.equal(JSON.stringify(readiness).includes("webhook"), false);
});

test("toPublicReadiness strips missing credential names from public payloads", () => {
  const publicState = toPublicReadiness(getDailyReadiness({}));
  assert.deepEqual(publicState, {
    provider: "daily",
    configured: false,
    enabled: false,
    live: false,
  });
  assert.equal("missing" in publicState, false);
});

test("live workflows default off and preview mutations require explicit opt-in", () => {
  assert.equal(getLiveWorkflowsReadiness({}).enabled, false);
  assert.equal(isPreviewMutationAllowed({}), false);
  assert.equal(
    isPreviewMutationAllowed({ FADEN_ALLOW_PREVIEW_MUTATIONS: "true" }),
    true,
  );
  assert.equal(
    isPreviewMutationAllowed({
      FADEN_ALLOW_PREVIEW_MUTATIONS: "true",
      FADEN_ENABLE_LIVE_WORKFLOWS: "true",
    }),
    false,
  );
});

test("payments readiness covers missing, partial and live states", () => {
  const missing = getPaymentsReadiness({});
  assert.equal(missing.configured, false);
  assert.equal(missing.enabled, false);
  assert.equal(missing.live, false);
  assert.deepEqual(missing.missing, [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ]);

  const partial = getPaymentsReadiness(paymentsBase);
  assert.equal(partial.configured, true);
  assert.equal(partial.enabled, true);
  assert.equal(partial.live, false);

  const live = getPaymentsReadiness({
    ...paymentsBase,
    FADEN_ENABLE_LIVE_WORKFLOWS: "true",
  });
  assert.equal(live.live, true);
});

test("shipping readiness covers missing, partial and live states", () => {
  const missing = getShippingReadiness({});
  assert.equal(missing.configured, false);
  assert.equal(missing.live, false);

  const partial = getShippingReadiness(shiprocketBase);
  assert.equal(partial.configured, true);
  assert.equal(partial.enabled, true);
  assert.equal(partial.live, false);

  const live = getShippingReadiness({
    ...shiprocketBase,
    FADEN_ENABLE_LIVE_WORKFLOWS: "true",
  });
  assert.equal(live.live, true);
});

test("daily readiness covers missing, partial and live states", () => {
  const missing = getDailyReadiness({});
  assert.equal(missing.configured, false);
  assert.equal(missing.live, false);

  const partial = getDailyReadiness(dailyBase);
  assert.equal(partial.configured, true);
  assert.equal(partial.enabled, true);
  assert.equal(partial.live, false);

  const live = getDailyReadiness({
    ...dailyBase,
    FADEN_ENABLE_LIVE_WORKFLOWS: "true",
  });
  assert.equal(live.live, true);
});

test("maps readiness does not require live workflow activation", () => {
  const missing = getMapsReadiness({});
  assert.equal(missing.configured, false);
  assert.equal(missing.live, false);

  const enabled = getMapsReadiness({
    GEOAPIFY_API_KEY: "maps-key",
    MAPS_API_ENABLED: "true",
  });
  assert.equal(enabled.configured, true);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.live, true);
});

test("email readiness covers missing, partial and live states", () => {
  const missing = getEmailReadiness({});
  assert.equal(missing.configured, false);
  assert.deepEqual(missing.missing, [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
  ]);

  const partial = getEmailReadiness({
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer",
    SMTP_PASSWORD: "secret",
    EMAIL_DISPATCH_ENABLED: "true",
  });
  assert.equal(partial.configured, true);
  assert.equal(partial.enabled, true);
  assert.equal(partial.live, false);

  const live = getEmailReadiness({
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer",
    SMTP_PASSWORD: "secret",
    EMAIL_DISPATCH_ENABLED: "true",
    FADEN_ENABLE_LIVE_WORKFLOWS: "true",
  });
  assert.equal(live.live, true);
});
