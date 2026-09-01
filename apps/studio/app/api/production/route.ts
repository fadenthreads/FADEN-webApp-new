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
      { error: "Rehearsal updates are disabled in production." },
      { status: 503 },
    );
  const supabase = await getSupabaseServerClient();
  if (!(await supabase.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 12000)
      return NextResponse.json({ error: "Update too large." }, { status: 413 });
    const b = JSON.parse(text);
    if (
      !b ||
      typeof b.orderId !== "string" ||
      typeof b.commandId !== "string" ||
      !Number.isInteger(b.sequence) ||
      !Number.isInteger(b.stage) ||
      typeof b.note !== "string" ||
      (b.photo !== null && typeof b.photo !== "string") ||
      b.confirmed !== true
    )
      return NextResponse.json(
        { error: "Complete and confirm your rehearsal update." },
        { status: 400 },
      );
    const { data, error } = await supabase.rpc("record_production_update", {
      target_order: b.orderId,
      expected_sequence: b.sequence,
      target_stage: b.stage,
      progress_note: b.note,
      photo: b.photo,
      command_id: b.commandId,
      confirmed: b.confirmed,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "Could not record progress. Reload and try again.",
        },
        { status: 409 },
      );
    return NextResponse.json({ id: data });
  } catch {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
}
