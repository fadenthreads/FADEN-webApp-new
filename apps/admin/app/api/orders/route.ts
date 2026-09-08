import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireAdminAal2,
  requireSameOrigin,
} from "@faden/server";
import { validateOrderCommand } from "../../../lib/admin-orders-core.mjs";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;
    const supabase = await getSupabaseServerClient();
    const user = await requireAdminAal2(supabase);
    if (isNextResponse(user)) return user;
    const body = await readJsonBody(request, 4096);
    if (isNextResponse(body)) return body;
    const command = validateOrderCommand(body);
    if (!command)
      return jsonError("Invalid order operation.", 400, "invalid_request");
    let result;
    if (command.action === "claim" || command.action === "unclaim")
      result = await supabase.rpc("admin_claim_order_fulfilment", {
        p_order_id: command.orderId,
        p_expected_version: command.expectedVersion,
        p_claim: command.action === "claim",
      });
    else if (command.action === "note")
      result = await supabase.rpc("admin_add_order_note", {
        p_order_id: command.orderId,
        p_body: command.body,
      });
    else if (command.action === "reveal_address")
      result = await supabase.rpc("admin_reveal_order_address", {
        p_order_id: command.orderId,
        p_reason: command.reason,
      });
    else
      result = await supabase.rpc("admin_upsert_manual_shipment", {
        p_order_id: command.orderId,
        p_expected_version: command.expectedVersion,
        p_carrier_name: command.carrierName,
        p_tracking_number: command.trackingNumber,
        p_tracking_url: command.trackingUrl,
        p_status: command.status,
        p_admin_note: command.adminNote,
        p_confirm_delivered: command.confirmDelivered,
      });
    if (result.error)
      return jsonError(
        "This order could not be updated. Reload and try again.",
        409,
        "order_conflict",
      );
    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return jsonError(
      "An unexpected error occurred.",
      500,
      "internal_server_error",
    );
  }
}
