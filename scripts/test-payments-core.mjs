import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  testCredentials,
  verifyHmac,
  verifyCheckout,
  capturedPayment,
  razorpayRequest,
} from "../apps/marketplace/lib/razorpay-core.mjs";
import { mergeLocalEnv } from "./merge-local-env.mjs";
import { processWebhook } from "../apps/marketplace/lib/webhook-core.mjs";
const secret = "unit-test-only";
const signature = (message) =>
  createHmac("sha256", secret).update(message).digest("hex");
test("signed webhook processing rejects malformed or unsigned events and retries storage/provider failures", async () => {
  const raw = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_fixture",
            order_id: "order_fixture",
            amount: 1,
            status: "captured",
          },
        },
      },
    }),
  );
  let lookedUp = 0,
    reconciled = 0;
  const deps = {
    secret,
    findAttempt: async (id) => {
      lookedUp++;
      assert.equal(id, "order_fixture");
      return { id: "attempt" };
    },
    reconcile: async (a, p) => {
      reconciled++;
      assert.equal(a.id, "attempt");
      assert.equal(p, "pay_fixture");
    },
  };
  assert.equal(await processWebhook(raw, "invalid", deps), 401);
  assert.equal(lookedUp, 0);
  assert.equal(
    await processWebhook(raw, signature(raw), { ...deps, secret: "" }),
    503,
  );
  assert.equal(await processWebhook(raw, signature(raw), deps), 200);
  assert.equal(reconciled, 1);
  const broken = Buffer.from("{broken");
  assert.equal(await processWebhook(broken, signature(broken), deps), 400);
  assert.equal(
    await processWebhook(raw, signature(raw), {
      ...deps,
      findAttempt: async () => null,
    }),
    200,
  );
  assert.equal(
    await processWebhook(raw, signature(raw), {
      ...deps,
      reconcile: async () => {
        throw new Error("provider unavailable");
      },
    }),
    503,
  );
  assert.equal(
    await processWebhook(raw, signature(raw), {
      ...deps,
      findAttempt: async () => {
        throw new Error("database unavailable");
      },
    }),
    503,
  );
  const failed = Buffer.from(JSON.stringify({ event: "payment.failed" }));
  assert.equal(await processWebhook(failed, signature(failed), deps), 200);
  const invalid = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  assert.equal(await processWebhook(invalid, signature(invalid), deps), 400);
});
test("test-only configuration rejects missing and live credentials", () => {
  assert.throws(() => testCredentials({}));
  assert.throws(() =>
    testCredentials({
      RAZORPAY_KEY_ID: "rzp_live_example",
      RAZORPAY_KEY_SECRET: secret,
    }),
  );
  assert.equal(
    testCredentials({
      RAZORPAY_KEY_ID: "rzp_test_example",
      RAZORPAY_KEY_SECRET: secret,
    }).keyId,
    "rzp_test_example",
  );
});
test("checkout HMAC binds stored order and payment; spoofed orders/signatures rejected", () => {
  const sig = signature("order_test|pay_test");
  assert.equal(verifyCheckout("order_test", "pay_test", sig, secret), true);
  assert.equal(verifyCheckout("order_other", "pay_test", sig, secret), false);
  assert.equal(verifyCheckout("order_test", "pay_other", sig, secret), false);
  for (const bad of [null, {}, "", sig.slice(2), "z".repeat(64)])
    assert.equal(verifyHmac("order_test|pay_test", bad, secret), false);
});
test("webhook HMAC validates raw bytes, not parsed and reserialized JSON", () => {
  const raw = Buffer.from('{ "event": "payment.captured" }');
  assert.ok(verifyHmac(raw, signature(raw), secret));
  assert.equal(
    verifyHmac(JSON.stringify(JSON.parse(raw)), signature(raw), secret),
    false,
  );
  assert.equal(verifyHmac(raw, signature(raw), "another-secret"), false);
});
test("only exact captured and unrefunded payments qualify", () => {
  const a = { provider_order_id: "order_test", amount_paise: 12345 },
    p = {
      id: "pay_test",
      order_id: "order_test",
      amount: 12345,
      currency: "INR",
      captured: true,
      status: "captured",
      amount_refunded: 0,
    };
  assert.ok(capturedPayment(p, a));
  for (const patch of [
    { status: "authorized" },
    { status: "failed" },
    { captured: false },
    { amount: 12344 },
    { currency: "USD" },
    { order_id: "order_other" },
    { amount_refunded: 1 },
    { id: "invalid" },
  ])
    assert.equal(capturedPayment({ ...p, ...patch }, a), false);
});
test("provider adapter sends fixed origin, exact payload and rejects redirects/errors without exposing bodies", async () => {
  let calls = 0;
  const credentials = { keyId: "rzp_test_fixture", secret };
  const result = await razorpayRequest("/orders", {
    method: "POST",
    credentials,
    body: { amount: 100, currency: "INR", receipt: "fixture" },
    fetcher: async (url, opts) => {
      calls++;
      assert.equal(url, "https://api.razorpay.com/v1/orders");
      assert.equal(opts.redirect, "error");
      assert.equal(opts.cache, "no-store");
      assert.equal(JSON.parse(opts.body).amount, 100);
      return { ok: true, json: async () => ({ id: "order_fixture" }) };
    },
  });
  assert.equal(result.id, "order_fixture");
  assert.equal(calls, 1);
  await assert.rejects(
    razorpayRequest("/orders", {
      credentials,
      fetcher: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ secret: "must not surface" }),
      }),
    }),
    (e) => e.message.includes("401") && !e.message.includes("must not surface"),
  );
  await assert.rejects(razorpayRequest("//evil.example", { credentials }));
  await assert.rejects(
    razorpayRequest("/orders", {
      credentials: { keyId: "rzp_live_fixture", secret },
    }),
  );
});
test("environment sync retains integration secrets, custom settings and comments without propagating them", () => {
  const existing =
      '# keep\nRAZORPAY_KEY_SECRET="fictional"\nNEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true\nNEXT_PUBLIC_SUPABASE_URL=old\n',
    defaults =
      "NEXT_PUBLIC_SUPABASE_URL=new\nNEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false\nDATABASE_URL=local\n";
  const result = mergeLocalEnv(existing, defaults);
  assert.ok(result.includes('RAZORPAY_KEY_SECRET="fictional"'));
  assert.ok(result.includes("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true"));
  assert.ok(result.includes("NEXT_PUBLIC_SUPABASE_URL=new"));
  assert.ok(!result.includes("URL=old"));
  assert.equal(mergeLocalEnv(result, defaults), result);
  assert.ok(!mergeLocalEnv("", defaults).includes("RAZORPAY"));
});
