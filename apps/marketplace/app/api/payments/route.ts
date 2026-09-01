import { NextRequest, NextResponse } from "next/server";
import { requestContext, jsonBody, apiError } from "../../../lib/request-api";
import {
  paymentAdmin,
  reconcilePayment,
  type Attempt,
} from "../../../lib/payments";
import {
  razorpayRequest,
  testCredentials,
  verifyCheckout,
} from "../../../lib/razorpay-core.mjs";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requestContext(request),
      body = await jsonBody(request);
    if (
      typeof body.orderId !== "string" ||
      !["start", "verify", "refresh"].includes(body.action)
    )
      throw new Error("Invalid payment request.");
    const { data: order, error } = await supabase
      .from("customer_orders")
      .select()
      .eq("id", body.orderId)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");
    const credentials = testCredentials();
    if (body.action === "start") {
      if (body.confirmed !== true)
        throw new Error("Confirm the test advance before opening checkout.");
      if (order.status === "test_advance_paid")
        return NextResponse.json({ status: "captured" });
      const admin = paymentAdmin();
      const result = await admin.rpc("reserve_test_payment", {
        target_order: order.id,
        actor: user.id,
        public_key_id: credentials.keyId,
      });
      if (result.error) throw new Error(result.error.message);
      const attempt = result.data as unknown as Attempt & { is_new: boolean };
      if (attempt.is_new) {
        // A failed/ambiguous provider request leaves this reservation locked. Never silently
        // create another remote order: remote creation and our DB commit are not atomic.
        const gateway = await razorpayRequest("/orders", {
          method: "POST",
          credentials,
          body: {
            amount: attempt.amount_paise,
            currency: "INR",
            receipt: attempt.id,
            partial_payment: false,
          },
        });
        if (
          !/^order_[A-Za-z0-9]+$/.test(gateway.id) ||
          gateway.amount !== attempt.amount_paise ||
          gateway.currency !== "INR" ||
          gateway.receipt !== attempt.id
        )
          throw new Error(
            "Gateway order mismatch; reconciliation is required.",
          );
        const attached = await admin.rpc("attach_test_gateway_order", {
          target_attempt: attempt.id,
          gateway_order: gateway.id,
          amount: attempt.amount_paise,
        });
        if (attached.error)
          throw new Error("Checkout needs reconciliation. Do not pay again.");
        attempt.provider_order_id = gateway.id;
      }
      if (!attempt.provider_order_id)
        throw new Error(
          "Checkout creation is pending or unresolved. Wait and refresh; do not create another order. Support reconciliation may be required.",
        );
      // Reusing the same provider order permits failed-payment retries, not duplicate advances.
      const state = await reconcilePayment(attempt);
      if (state === "captured")
        return NextResponse.json({ status: "captured" });
      if (state === "authorized")
        throw new Error(
          "Payment is authorized, awaiting capture. Do not pay again; refresh its status.",
        );
      return NextResponse.json({
        status: "ready",
        key: credentials.keyId,
        order_id: attempt.provider_order_id,
        amount: attempt.amount_paise,
        currency: "INR",
      });
    }
    const { data: attempt } = await supabase
      .from("order_payment_attempts")
      .select()
      .eq("order_id", order.id)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (!attempt) throw new Error("Checkout has not started.");
    if (body.action === "verify") {
      if (
        typeof body.paymentId !== "string" ||
        body.providerOrderId !== attempt.provider_order_id ||
        !verifyCheckout(
          attempt.provider_order_id ?? "",
          body.paymentId,
          body.signature,
          credentials.secret,
        )
      )
        throw new Error("Payment signature verification failed.");
    }
    return NextResponse.json({
      status: await reconcilePayment(
        attempt,
        body.action === "verify" ? body.paymentId : undefined,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
