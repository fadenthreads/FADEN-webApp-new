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
    return jsonError("Aftercare rehearsal is disabled in production.", 503);
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 8000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (
    !b ||
    b.confirmed !== true ||
    typeof b.commandId !== "string" ||
    typeof b.note !== "string"
  )
    return jsonError("Complete and confirm your preview submission.", 400);
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
    } as never);
  else if (
    b.action === "update" &&
    typeof b.itemId === "string" &&
    Number.isInteger(b.version) &&
    typeof b.status === "string"
  )
    result = await db.rpc("update_aftercare_rehearsal", {
      target_item: b.itemId,
      expected_version: b.version as number,
      next_status: b.status,
      response_note: b.note,
      command_id: b.commandId,
      confirmed: true,
    });
  else return jsonError("Invalid aftercare action.", 400);
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
}
