import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@faden/supabase";
import {
  capturedPayment,
  paymentMatches,
  razorpayRequest,
  testCredentials,
} from "./razorpay-core.mjs";
export type Attempt =
  Database["public"]["Tables"]["order_payment_attempts"]["Row"];
class DisabledRealtimeTransport {}
export function paymentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret)
    throw new Error("Server payment storage is not configured.");
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: DisabledRealtimeTransport as never },
  });
}
export function testCheckoutAvailable() {
  try {
    testCredentials();
    return Boolean(process.env.SUPABASE_SECRET_KEY);
  } catch {
    return false;
  }
}
export async function reconcilePayment(attempt: Attempt, paymentId?: string) {
  const credentials = testCredentials();
  if (attempt.key_id !== credentials.keyId)
    throw new Error("Payment credentials changed; reconciliation is required.");
  if (!attempt.provider_order_id)
    throw new Error(
      "Checkout creation is unresolved. Do not create another payment; this attempt needs reconciliation.",
    );
  const payload = paymentId
    ? {
        items: [
          await razorpayRequest(`/payments/${paymentId}`, { credentials }),
        ],
      }
    : await razorpayRequest(`/orders/${attempt.provider_order_id}/payments`, {
        credentials,
      });
  if (!Array.isArray(payload.items))
    throw new Error("Payment status could not be confirmed.");
  let status = "pending";
  for (const payment of payload.items) {
    if (!paymentMatches(payment, attempt))
      throw new Error("Payment does not match this order's saved advance.");
    if (capturedPayment(payment, attempt)) {
      const { error } = await paymentAdmin().rpc("record_test_capture", {
        target_attempt: attempt.id,
        gateway_order: attempt.provider_order_id,
        gateway_payment: payment.id,
        amount: attempt.amount_paise,
        payment_currency: "INR",
      });
      if (error)
        throw new Error("Payment needs reconciliation. Do not pay again.");
      return "captured";
    }
    if (payment.status === "authorized") status = "authorized";
  }
  return status;
}
