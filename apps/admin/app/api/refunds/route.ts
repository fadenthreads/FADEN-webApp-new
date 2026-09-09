import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireAdminAal2,
  requireSameOrigin,
} from "@faden/server";
import {
  razorpayRequest,
  testCredentials,
} from "../../../../marketplace/lib/razorpay-core.mjs";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireAdminAal2(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 2048);
  if (isNextResponse(body)) return body;
  const input = body as Record<string, unknown>;
  if (
    typeof input.order_id !== "string" ||
    typeof input.amount_paise !== "number" ||
    !Number.isSafeInteger(input.amount_paise) ||
    typeof input.reason !== "string"
  )
    return jsonError("Invalid refund request.", 400, "invalid_request");
  try {
    const { data: refund, error } = await supabase.rpc(
      "admin_create_test_refund",
      {
        p_order_id: input.order_id,
        p_amount_paise: input.amount_paise,
        p_reason: input.reason,
      },
    );
    if (error || !refund)
      return jsonError("Refund could not be started.", 409, "refund_conflict");
    const result = refund as {
      id: string;
      provider_payment_id: string;
      amount_paise: number;
    };
    const gateway = await razorpayRequest(
      `/payments/${result.provider_payment_id}/refund`,
      {
        method: "POST",
        credentials: testCredentials(),
        body: {
          amount: result.amount_paise,
          notes: { faden_refund_id: result.id },
        },
      },
    );
    if (!/^rfnd_[A-Za-z0-9]+$/.test(String(gateway.id)))
      throw new Error("Provider refund reference was invalid.");
    const attached = await supabase.rpc("attach_test_refund", {
      p_refund_id: result.id,
      p_provider_refund_id: gateway.id,
    });
    if (attached.error) throw new Error("Refund needs reconciliation.");
    return NextResponse.json({ status: "pending" });
  } catch {
    return jsonError(
      "Refund could not be started. Do not retry until it is reconciled.",
      503,
      "refund_pending",
    );
  }
}
