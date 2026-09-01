import { NextRequest, NextResponse } from "next/server";
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
    return jsonError("Messaging preview is disabled in production.", 503);
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 12_000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (!b || typeof b.orderId !== "string")
    return jsonError("Invalid conversation.", 400);
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
      through_sequence: b.through as number,
    });
  else return jsonError("Invalid message action.", 400);
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
}
