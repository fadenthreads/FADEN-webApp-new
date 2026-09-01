import { NextRequest, NextResponse } from "next/server";
import { isPreviewMutationAllowed } from "@faden/integrations";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!isPreviewMutationAllowed())
    return NextResponse.json(
      { error: "Fulfilment rehearsal is disabled in production." },
      { status: 503 },
    );
  const supabase = await getSupabaseServerClient();
  if (!(await supabase.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 8000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const b = JSON.parse(text);
    if (!b || typeof b.orderId !== "string" || b.confirmed !== true)
      return NextResponse.json(
        { error: "Complete and confirm the rehearsal details." },
        { status: 400 },
      );
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
        expected_revision: b.revision,
        details: b.details,
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
        expected_sequence: b.sequence,
        target_stage: b.stage,
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
    else
      return NextResponse.json(
        { error: "Invalid fulfilment action." },
        { status: 400 },
      );
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
  } catch {
    return NextResponse.json(
      { error: "Invalid fulfilment request." },
      { status: 400 },
    );
  }
}
