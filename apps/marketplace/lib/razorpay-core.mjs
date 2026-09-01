import { createHmac, timingSafeEqual } from "node:crypto";

// This module has no environment side effects and can be tested without any credentials.
export function testCredentials(env = process.env) {
  const keyId = env.RAZORPAY_KEY_ID,
    secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || !secret)
    throw new Error(
      "Razorpay test credentials are not configured. Live payments are disabled.",
    );
  return { keyId, secret };
}
export function verifyHmac(message, signature, secret) {
  if (
    typeof signature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(signature) ||
    !secret
  )
    return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function verifyCheckout(orderId, paymentId, signature, secret) {
  return (
    /^order_[A-Za-z0-9]+$/.test(orderId) &&
    /^pay_[A-Za-z0-9]+$/.test(paymentId) &&
    verifyHmac(`${orderId}|${paymentId}`, signature, secret)
  );
}
export function paymentMatches(payment, attempt) {
  return (
    payment?.order_id === attempt.provider_order_id &&
    payment?.amount === attempt.amount_paise &&
    payment?.currency === "INR" &&
    /^pay_[A-Za-z0-9]+$/.test(payment?.id ?? "")
  );
}
export function capturedPayment(payment, attempt) {
  return (
    paymentMatches(payment, attempt) &&
    payment.status === "captured" &&
    payment.captured === true &&
    payment.amount_refunded === 0
  );
}
/** @param {string} path
 * @param {{method?:string,body?:Record<string,unknown>,credentials?:{keyId:string,secret:string},fetcher?:typeof fetch}} options */
export async function razorpayRequest(
  path,
  {
    method = "GET",
    body,
    credentials = testCredentials(),
    fetcher = fetch,
  } = {},
) {
  // Fixed provider origin; paths cannot be supplied by a browser.
  if (!/^\/(orders|payments)(\/[A-Za-z0-9_]+)*(\?count=1)?$/.test(path))
    throw new Error("Invalid payment API path");
  if (!credentials.keyId.startsWith("rzp_test_"))
    throw new Error("Live payments are disabled");
  const response = await fetcher(`https://api.razorpay.com/v1${path}`, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Do not echo provider bodies, account data or credentials into user-facing errors/logs.
  if (!response.ok)
    throw new Error(
      `Razorpay request failed (${response.status}). Check test configuration or reconcile the existing attempt before retrying.`,
    );
  return response.json();
}
