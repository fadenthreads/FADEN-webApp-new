import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (process.env.NEXT_PUBLIC_APP_ENV === "production")
    return NextResponse.json(
      { error: "Aftercare rehearsal is disabled in production." },
      { status: 503 },
    );
  const db = await getSupabaseServerClient();
  if (!(await db.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 8000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const b = JSON.parse(text);
    if (
      !b ||
      b.confirmed !== true ||
      typeof b.commandId !== "string" ||
      typeof b.note !== "string"
    )
      return NextResponse.json(
        { error: "Complete and confirm your preview submission." },
        { status: 400 },
      );
    let result;
    if (
      b.action === "submit" &&
      typeof b.orderId === "string" &&
      (b.kind === "review" || b.kind === "alteration") &&
      (b.rating === null || Number.isInteger(b.rating))
    )
      result = await db.rpc("submit_aftercare_rehearsal", {
        target_order: b.orderId,
        item_kind: b.kind,
        stars: b.rating,
        customer_note: b.note,
        command_id: b.commandId,
        confirmed: true,
      });
    else if (
      b.action === "update" &&
      typeof b.itemId === "string" &&
      Number.isInteger(b.version) &&
      typeof b.status === "string"
    )
      result = await db.rpc("update_aftercare_rehearsal", {
        target_item: b.itemId,
        expected_version: b.version,
        next_status: b.status,
        response_note: b.note,
        command_id: b.commandId,
        confirmed: true,
      });
    else
      return NextResponse.json(
        { error: "Invalid aftercare action." },
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
    return NextResponse.json({ id: result.data });
  } catch {
    return NextResponse.json(
      { error: "Invalid aftercare request." },
      { status: 400 },
    );
  }
}
