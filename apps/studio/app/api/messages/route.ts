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
      { error: "Messaging preview is disabled in production." },
      { status: 503 },
    );
  const db = await getSupabaseServerClient();
  if (!(await db.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 12000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const b = JSON.parse(text);
    if (!b || typeof b.orderId !== "string")
      return NextResponse.json(
        { error: "Invalid conversation." },
        { status: 400 },
      );
    let result;
    if (
      b.action === "send" &&
      typeof b.body === "string" &&
      typeof b.commandId === "string"
    )
      result = await db.rpc("send_order_message", {
        target_order: b.orderId,
        message_body: b.body,
        command_id: b.commandId,
      });
    else if (b.action === "read" && Number.isInteger(b.through))
      result = await db.rpc("mark_order_messages_read", {
        target_order: b.orderId,
        through_sequence: b.through,
      });
    else
      return NextResponse.json(
        { error: "Invalid message action." },
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
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid message request." },
      { status: 400 },
    );
  }
}
