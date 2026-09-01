import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@faden/supabase";
import { isPreviewMutationAllowed } from "@faden/integrations";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  if (!isPreviewMutationAllowed())
    return jsonError("Fulfilment rehearsal is disabled in production.", 503);
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 8000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (!b || typeof b.orderId !== "string" || b.confirmed !== true)
    return jsonError("Complete and confirm the rehearsal details.", 400);
  let result;
  if (
    b.action === "address" &&
    Number.isInteger(b.revision) &&
    typeof b.commandId === "string" &&
    b.details &&
    typeof b.details === "object"
  )
    result = await supabase.rpc("save_order_delivery_details", {
      target_order: b.orderId,
      expected_revision: b.revision as number,
      details: b.details as Json,
      command_id: b.commandId,
      confirmed: true,
    });
  else if (
    b.action === "progress" &&
    Number.isInteger(b.sequence) &&
    Number.isInteger(b.stage) &&
    typeof b.note === "string" &&
    typeof b.commandId === "string"
  )
    result = await supabase.rpc("record_shipment_rehearsal", {
      target_order: b.orderId,
      expected_sequence: b.sequence as number,
      target_stage: b.stage as number,
      progress_note: b.note,
      command_id: b.commandId,
      confirmed: true,
    });
  else if (b.action === "confirm" && typeof b.eventId === "string")
    result = await supabase.rpc("confirm_delivery_rehearsal", {
      target_order: b.orderId,
      expected_event: b.eventId,
      confirmed: true,
    });
  else return jsonError("Invalid fulfilment action.", 400);
  if (result.error)
    return NextResponse.json(
      {
        error:
          result.error.code === "P0001"
            ? result.error.message
            : "Could not save. Reload and retry.",
      },
      { status: 409 },
    );
  return NextResponse.json({ result: result.data });
}
