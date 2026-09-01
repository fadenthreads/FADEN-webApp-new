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
      { error: "Preview booking is disabled in production." },
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
    if (!b || typeof b !== "object") throw new Error();
    let result;
    if (
      b.action === "create" &&
      typeof b.start === "string" &&
      typeof b.end === "string" &&
      typeof b.kind === "string" &&
      typeof b.location === "string" &&
      typeof b.commandId === "string" &&
      typeof b.boutiqueId === "string" &&
      /(Z|[+-]\d{2}:\d{2})$/.test(b.start) &&
      /(Z|[+-]\d{2}:\d{2})$/.test(b.end)
    )
      result = await supabase.rpc("create_appointment_slot", {
        slot_id: b.commandId,
        target_boutique: b.boutiqueId,
        starts: b.start,
        ends: b.end,
        session_kind: b.kind,
        session_location: b.location,
      });
    else if (
      b.action === "reserve" &&
      typeof b.orderId === "string" &&
      typeof b.slotId === "string" &&
      typeof b.commandId === "string" &&
      (b.replacing === null || typeof b.replacing === "string") &&
      b.confirmed === true
    )
      result = await supabase.rpc("reserve_measurement_appointment", {
        target_order: b.orderId,
        target_slot: b.slotId,
        command_id: b.commandId,
        replacing: b.replacing,
        confirmed: true,
      });
    else if (
      b.action === "cancel" &&
      typeof b.appointmentId === "string" &&
      b.confirmed === true
    )
      result = await supabase.rpc("cancel_measurement_appointment", {
        target_appointment: b.appointmentId,
        confirmed: true,
      });
    else if (
      b.action === "outcome" &&
      typeof b.appointmentId === "string" &&
      (b.outcome === "completed" || b.outcome === "no_show") &&
      b.confirmed === true
    )
      result = await supabase.rpc("record_appointment_outcome", {
        target_appointment: b.appointmentId,
        session_outcome: b.outcome,
        confirmed: true,
      });
    else if (b.action === "withdraw" && typeof b.slotId === "string")
      result = await supabase.rpc("withdraw_appointment_slot", {
        target_slot: b.slotId,
      });
    else
      return NextResponse.json(
        { error: "Complete and confirm the appointment details." },
        { status: 400 },
      );
    if (result.error)
      return NextResponse.json(
        {
          error:
            result.error.code === "P0001"
              ? result.error.message
              : "Could not save your appointment. Reload and retry.",
        },
        { status: 409 },
      );
    return NextResponse.json({ id: result.data });
  } catch {
    return NextResponse.json(
      { error: "Invalid appointment request." },
      { status: 400 },
    );
  }
}
