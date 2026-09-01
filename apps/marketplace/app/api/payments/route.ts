import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
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
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 55_000);
  if (isNextResponse(body)) return body;
  try {
    const payload = body as Record<string, unknown>;
    if (
      typeof payload.orderId !== "string" ||
      !["start", "verify", "refresh"].includes(String(payload.action))
    )
      throw new Error("Invalid payment request.");
    const { data: order, error } = await supabase
      .from("customer_orders")
      .select()
      .eq("id", payload.orderId)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");
    const credentials = testCredentials();
    if (payload.action === "start") {
      if (payload.confirmed !== true)
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
    if (payload.action === "verify") {
      if (
        typeof payload.paymentId !== "string" ||
        payload.providerOrderId !== attempt.provider_order_id ||
        !verifyCheckout(
          attempt.provider_order_id ?? "",
          payload.paymentId,
          payload.signature as string,
          credentials.secret,
        )
      )
        throw new Error("Payment signature verification failed.");
    }
    return NextResponse.json({
      status: await reconcilePayment(
        attempt,
        payload.action === "verify" ? (payload.paymentId as string) : undefined,
      ),
    });
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
