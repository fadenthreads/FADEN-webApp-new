import { NextRequest, NextResponse } from "next/server";
import { paymentAdmin, reconcilePayment } from "../../../../lib/payments";
import { processWebhook } from "../../../../lib/webhook-core.mjs";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 262144) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(value);
  }
  const status = await processWebhook(
    Buffer.concat(chunks),
    request.headers.get("x-razorpay-signature"),
    {
      secret,
      eventId: request.headers.get("x-razorpay-event-id") ?? undefined,
      recordEvent: async (
        eventId: string,
        eventType: string,
        providerOrderId: string | null,
        providerPaymentId: string | null,
      ) => {
        const { data, error } = await paymentAdmin().rpc(
          "record_test_provider_event",
          {
            p_event_id: eventId,
            p_event_type: eventType,
            p_provider_order_id: providerOrderId ?? undefined,
            p_provider_payment_id: providerPaymentId ?? undefined,
          },
        );
        if (error) throw error;
        return data;
      },
      findAttempt: async (providerOrder: string) => {
        const { data, error } = await paymentAdmin()
          .from("order_payment_attempts")
          .select()
          .eq("provider_order_id", providerOrder)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      reconcile: reconcilePayment,
      reconcileRefund: async (
        refundId: string,
        status: "processed" | "failed",
      ) => {
        const { error } = await paymentAdmin().rpc(
          "record_test_refund_outcome",
          {
            p_provider_refund_id: refundId,
            p_status: status,
          },
        );
        if (error) throw error;
      },
    },
  );
  return NextResponse.json({ received: status === 200 }, { status });
}
